(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  let stream = null;
  let timer = null;
  let generation = 0;
  let busy = false;
  let candidate = null;
  let options = null;
  let controller = null;
  let initialized = false;

  function stopCamera() {
    clearTimeout(timer);
    timer = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    $("passportVideo").srcObject = null;
    $("passportVideo").hidden = true;
  }

  function status(message) { $("passportScanStatus").textContent = message; }

  function initialize() {
    if (initialized) return;
    initialized = true;
    $("passportCameraButton").addEventListener("click", startCamera);
    $("passportScanCancel").addEventListener("click", () => $("passportScanDialog").close("cancel"));
    $("passportConfirmButton").addEventListener("click", () => {
      if (candidate) $("passportScanDialog").close("confirm");
    });
    $("passportScanDialog").addEventListener("close", () => {
      generation += 1;
      stopCamera();
      if (controller) controller.abort();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        generation += 1;
        stopCamera();
        if (controller) controller.abort();
        busy = false;
      }
    });
    window.addEventListener("pagehide", stopCamera);
  }

  function openDialog(dialog) {
    return new Promise(resolve => {
      dialog.returnValue = "";
      dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true });
      dialog.showModal();
    });
  }

  async function choose(settings) {
    initialize();
    const choice = await openDialog($("passportChoiceDialog"));
    if (choice === "guest") return { kind: "guest" };
    if (choice !== "member") return null;
    options = settings;
    candidate = null;
    busy = false;
    generation += 1;
    $("passportMemberPreview").hidden = true;
    const configured = Boolean(settings.enabled && settings.endpoint && settings.key);
    $("passportCameraButton").disabled = !configured;
    status(configured ? "会員証のQRコードを読み取ってください。" : "会員受付の連携設定が必要です。スタッフにお声がけください。");
    const result = await openDialog($("passportScanDialog"));
    return result === "confirm" ? candidate : null;
  }

  function decode(source, width, height) {
    const scale = Math.min(1, 960 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" })?.data;
  }

  async function startCamera() {
    if (busy) return;
    const run = ++generation;
    stopCamera();
    candidate = null;
    $("passportMemberPreview").hidden = true;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("カメラはHTTPSで開いてご利用ください。");
      }
      status("カメラを起動しています…");
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 960 } }, audio: false });
      if (run !== generation || !$("passportScanDialog").open) {
        camera.getTracks().forEach(track => track.stop());
        return;
      }
      stream = camera;
      const video = $("passportVideo");
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      status("会員証のQRコードをカメラに向けてください。");
      const scan = async () => {
        if (run !== generation || !stream) return;
        try {
          const value = video.readyState >= 2 && decode(video, video.videoWidth, video.videoHeight);
          if (value) { await lookup(value, run); return; }
          timer = setTimeout(scan, 180);
        } catch { stopCamera(); status("読み取りに失敗しました。もう一度カメラを起動してください。"); }
      };
      scan();
    } catch (error) {
      if (run !== generation) return;
      stopCamera();
      status(error.name === "NotAllowedError" ? "カメラの使用が許可されていません。Safariの設定からカメラを許可してください。" : error.message);
    }
  }

  async function lookup(qrIdentifier, run) {
    stopCamera();
    busy = true;
    status("会員情報を確認しています…");
    controller = new AbortController();
    try {
      const response = await request(options.endpoint, options.key, { action: "passport.lookup", qrIdentifier }, controller.signal);
      if (run !== generation) return;
      const member = response.member;
      if (!member?.memberNumber || !member.displayName || !member.memberToken) throw new Error("会員情報を確認できませんでした。");
      candidate = { kind: "member", ...member };
      $("passportMemberName").textContent = `${member.displayName} 様`;
      $("passportMemberNumber").textContent = member.memberNumber;
      $("passportMemberPreview").hidden = false;
      status("お名前をご確認ください。");
    } catch (error) { if (run === generation) status(error.message); }
    finally { if (run === generation) busy = false; }
  }

  async function request(endpoint, key, payload, signal) {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    if (signal?.aborted) cancel();
    signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 20000);
    try {
      const body = new URLSearchParams({ payload: JSON.stringify({ ...payload, kioskKey: key }) });
      const response = await fetch(endpoint, { method: "POST", body, signal: abort.signal, credentials: "omit" });
      if (!response.ok) throw new Error("連携先への接続に失敗しました。");
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "連携処理に失敗しました。");
      return result;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("通信を完了できませんでした。もう一度お試しください。");
      throw error;
    } finally { clearTimeout(timeout); signal?.removeEventListener("abort", cancel); }
  }

  window.PassportGacha = { choose, request };
})();
