(function () {
  "use strict";

  const STORAGE_HISTORY = "maidGachaHistory";
  const STORAGE_SOUND = "maidGachaSound";
  const STORAGE_SKIP = "maidGachaSkip";
  const STORAGE_GUEST_NAME = "maidGachaGuestName";
  const STORAGE_PENDING_LOGS = "maidGachaPendingSpreadsheetLogs";
  const STORAGE_SHEET_SETTINGS = "maidGachaSpreadsheetSettings";
  const capsulePalette = [
    ["#f54d7f", "#ffd94d"],
    ["#4ab6ff", "#fff4f7"],
    ["#ffd64d", "#ff7bad"],
    ["#ff8fbd", "#fff2c8"],
    ["#e93d48", "#ffffff"]
  ];
  const soundFiles = {
    tap: "audio/tap.mp3",
    gacha_start: "audio/gacha_start.mp3",
    click: "audio/click.mp3",
    capsule_drop: "audio/capsule_drop.mp3",
    hit: "audio/capsule_hit.mp3",
    charge: "audio/charge.mp3",
    capsule_open: "audio/capsule_open.mp3",
    sparkle: "audio/sparkle.mp3",
    result: "audio/result.mp3"
  };
  const missingSoundFiles = new Set();

  const AppState = {
    screen: "idle",
    isAnimating: false,
    selectedMaid: null,
    resultSaved: false,
    currentGuestName: "",
    currentHistory: [],
    pendingLogs: [],
    skipRequested: false,
    skipAvailable: true,
    soundEnabled: true,
    spreadsheetEnabled: false,
    spreadsheetEndpointUrl: "",
    deviceName: "",
    audioContext: null,
    timers: []
  };

  const $ = (id) => document.getElementById(id);
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    AppState.currentHistory = loadHistory();
    AppState.currentGuestName = localStorage.getItem(STORAGE_GUEST_NAME) || "";
    AppState.pendingLogs = loadPendingLogs();
    AppState.soundEnabled = localStorage.getItem(STORAGE_SOUND) !== "off";
    AppState.skipAvailable = localStorage.getItem(STORAGE_SKIP) !== "off";
    loadSpreadsheetSettings();

    createWindowCapsules();
    applyImageFallbacks();
    bindEvents();
    updateOrientation();
    renderHistory();
    renderAdmin();
    showScreen("idle");
  }

  function cacheElements() {
    [
      "app", "idleScreen", "resultScreen", "gachaButton", "againButton",
      "nextGuestButton", "machineHandle", "gachaMachine", "capsuleField",
      "dropCapsule", "focusLayer", "focusCapsule", "capsuleTop", "capsuleBottom",
      "focusMaid", "focusMaidImage", "focusPlaceholder", "focusMessage",
      "maidImage", "maidPlaceholder", "resultMessage", "historyList",
      "drawCount", "particleLayer", "flash", "skipButton", "adminTapTarget",
      "adminPanel", "closeAdminButton", "soundToggle", "skipToggle",
      "resetHistoryButton", "testAnimationButton", "maidCount", "adminDrawCount",
      "maidList", "confirmDialog", "orientationWarning", "guestDialog",
      "guestForm", "guestNameInput", "guestCancelButton", "guestNameLabel", "adminGuestName",
      "spreadsheetToggle", "spreadsheetUrlInput", "deviceNameInput",
      "saveSpreadsheetSettingsButton", "retrySyncButton", "pendingSyncCount"
    ].forEach((id) => { els[id] = $(id); });
  }

  function bindEvents() {
    els.gachaButton.addEventListener("click", startGacha);
    els.againButton.addEventListener("click", resetToIdle);
    els.nextGuestButton.addEventListener("click", confirmNextGuest);
    els.skipButton.addEventListener("click", requestSkip);
    els.closeAdminButton.addEventListener("click", () => els.adminPanel.classList.remove("is-active"));
    els.soundToggle.addEventListener("change", updateSoundSetting);
    els.skipToggle.addEventListener("change", updateSkipSetting);
    els.spreadsheetToggle.addEventListener("change", updateSpreadsheetEnabled);
    els.saveSpreadsheetSettingsButton.addEventListener("click", saveSpreadsheetSettings);
    els.retrySyncButton.addEventListener("click", retryPendingLogs);
    els.resetHistoryButton.addEventListener("click", confirmNextGuest);
    els.guestCancelButton.addEventListener("click", () => els.guestDialog.close("cancel"));
    els.guestForm.addEventListener("submit", (event) => {
      if (event.submitter && event.submitter.value === "cancel") return;
      if (!els.guestNameInput.value.trim()) {
        event.preventDefault();
        els.guestNameInput.focus();
      }
    });
    els.testAnimationButton.addEventListener("click", () => {
      els.adminPanel.classList.remove("is-active");
      startGacha();
    });
    window.addEventListener("resize", updateOrientation, { passive: true });
    window.addEventListener("orientationchange", updateOrientation, { passive: true });

    let tapCount = 0;
    let tapTimer = 0;
    els.adminTapTarget.addEventListener("click", () => {
      tapCount += 1;
      clearTimeout(tapTimer);
      tapTimer = window.setTimeout(() => { tapCount = 0; }, 1200);
      if (tapCount >= 5) {
        tapCount = 0;
        openAdmin();
      }
    });

    els.confirmDialog.addEventListener("close", () => {
      if (els.confirmDialog.returnValue === "confirm") {
        clearHistory();
        resetToIdle();
      }
    });
  }

  function wait(ms) {
    return new Promise((resolve) => {
      const timer = window.setTimeout(resolve, ms);
      AppState.timers.push(timer);
    });
  }

  function ensureGuestName() {
    if (AppState.currentGuestName) return Promise.resolve(AppState.currentGuestName);
    if (typeof els.guestDialog.showModal !== "function") {
      const name = prompt("ご主人様のお名前を入力してください。");
      return Promise.resolve(saveGuestName(name));
    }

    els.guestNameInput.value = "";
    els.guestDialog.showModal();
    window.setTimeout(() => els.guestNameInput.focus(), 80);

    return new Promise((resolve) => {
      const onClose = () => {
        els.guestDialog.removeEventListener("close", onClose);
        if (els.guestDialog.returnValue !== "confirm") {
          resolve("");
          return;
        }
        resolve(saveGuestName(els.guestNameInput.value));
      };
      els.guestDialog.addEventListener("close", onClose);
    });
  }

  function saveGuestName(name) {
    const normalized = (name || "").trim().replace(/\s+/g, " ");
    if (!normalized) return "";
    AppState.currentGuestName = normalized;
    localStorage.setItem(STORAGE_GUEST_NAME, normalized);
    renderHistory();
    renderAdmin();
    return normalized;
  }

  async function startGacha() {
    if (AppState.isAnimating || isLandscape()) return;
    unlockAudio();
    const guestName = await ensureGuestName();
    if (!guestName) return;
    const selectedMaid = drawMaid();
    if (!selectedMaid) {
      alert("ガチャに登録されているメイドさんがいません。\nconfig.jsを確認してください。");
      return;
    }

    AppState.screen = "animating";
    AppState.isAnimating = true;
    AppState.selectedMaid = selectedMaid;
    AppState.resultSaved = false;
    AppState.skipRequested = false;
    lockControls();

    try {
      await playGachaAnimation(selectedMaid);
    } catch (error) {
      console.error(error);
      finishResult(selectedMaid);
    }
  }

  async function playGachaAnimation(selectedMaid) {
    await playButtonAnimation();
    if (shouldSkip()) return skipToResult(selectedMaid);

    scheduleSkipButton();
    await playHandleAnimation();
    if (shouldSkip()) return skipToResult(selectedMaid);

    await playCapsuleMixAnimation();
    if (shouldSkip()) return skipToResult(selectedMaid);

    await playCapsuleDropAnimation();
    if (shouldSkip()) return skipToResult(selectedMaid);

    await playCapsuleFocusAnimation();
    if (shouldSkip()) return skipToResult(selectedMaid);

    await playCapsuleOpenAnimation();
    if (shouldSkip()) return skipToResult(selectedMaid);

    await showMaidResult(selectedMaid);
    finishResult(selectedMaid);
  }

  async function playButtonAnimation() {
    els.gachaButton.classList.add("is-pressed");
    playSound("tap");
    await wait(180);
    els.gachaButton.classList.remove("is-pressed");
  }

  async function playHandleAnimation() {
    playSound("gacha_start");
    resetAnimationClass(els.machineHandle, "is-turning");
    resetAnimationClass(els.gachaMachine, "is-shaking");
    els.capsuleField.classList.add("is-mixing");
    await wait(1480);
    playSound("click");
  }

  async function playCapsuleMixAnimation() {
    els.gachaMachine.classList.add("is-shaking");
    await wait(320);
    els.capsuleField.classList.remove("is-mixing");
    els.gachaMachine.classList.remove("is-shaking");
  }

  async function playCapsuleDropAnimation() {
    setCapsuleColors(els.dropCapsule);
    playSound("capsule_drop");
    resetAnimationClass(els.dropCapsule, "is-dropping");
    await wait(880);
    playSound("hit");
    await wait(760);
    els.dropCapsule.classList.remove("is-dropping");
  }

  async function playCapsuleFocusAnimation() {
    setCapsuleColors(els.focusCapsule);
    els.focusLayer.classList.add("is-active");
    resetAnimationClass(els.focusCapsule, "is-entering");
    await wait(460);
    els.focusCapsule.classList.add("is-charging");
    emitParticles(18, "ring");
    playSound("sparkle");
    await wait(720);
    document.body.classList.add("is-screen-shaking");
    await wait(240);
    document.body.classList.remove("is-screen-shaking");
    playSound("charge");
    await wait(500);
  }

  async function playCapsuleOpenAnimation() {
    els.focusCapsule.classList.remove("is-charging");
    els.focusCapsule.classList.add("is-open");
    resetAnimationClass(els.flash, "is-active");
    playSound("capsule_open");
    emitParticles(42, "burst");
    await wait(360);
  }

  async function showMaidResult(selectedMaid) {
    prepareMaidImage(els.focusMaidImage, els.focusPlaceholder, selectedMaid);
    els.focusMessage.textContent = `${displayName(selectedMaid)}が当たりました！`;
    resetAnimationClass(els.focusMaid, "is-showing");
    playSound("result");
    emitParticles(30, "fall");
    await wait(620);
    resetAnimationClass(els.focusMessage, "is-showing");
    await wait(900);
  }

  function skipToResult(selectedMaid) {
    cleanupAnimation();
    finishResult(selectedMaid);
  }

  function finishResult(selectedMaid) {
    cleanupAnimation();
    saveResult(selectedMaid);
    prepareMaidImage(els.maidImage, els.maidPlaceholder, selectedMaid);
    els.resultMessage.textContent = `${displayName(selectedMaid)}が当たりました！`;
    showScreen("result");
    AppState.screen = "result";
    AppState.isAnimating = false;
    unlockResultControls();
    renderHistory();
    renderAdmin();
  }

  function drawMaid() {
    if (!Array.isArray(window.maidConfig) && typeof maidConfig === "undefined") return null;
    const maids = (window.maidConfig || maidConfig || []).filter((maid) => maid && maid.name);
    if (maids.length === 0) return null;
    return maids[Math.floor(Math.random() * maids.length)];
  }

  function saveResult(maid) {
    if (AppState.resultSaved || !maid) return;
    const result = {
      resultId: createResultId(),
      guestName: AppState.currentGuestName || "未入力",
      id: maid.id,
      name: maid.name,
      image: maid.image,
      drawNumber: AppState.currentHistory.length + 1,
      deviceName: AppState.deviceName,
      synced: false,
      at: new Date().toISOString()
    };
    AppState.currentHistory.push(result);
    AppState.resultSaved = true;
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(AppState.currentHistory));
    queueSpreadsheetResult(result);
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function loadPendingLogs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_PENDING_LOGS) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function clearHistory() {
    AppState.currentHistory = [];
    AppState.resultSaved = false;
    AppState.currentGuestName = "";
    localStorage.removeItem(STORAGE_HISTORY);
    localStorage.removeItem(STORAGE_GUEST_NAME);
    renderHistory();
    renderAdmin();
  }

  function renderHistory() {
    els.guestNameLabel.textContent = `ご主人様: ${AppState.currentGuestName || "未入力"}`;
    els.drawCount.textContent = `今回のガチャ: ${AppState.currentHistory.length}回`;
    els.historyList.replaceChildren();
    AppState.currentHistory.slice(-5).forEach((item, index) => {
      const li = document.createElement("li");
      const number = document.createElement("span");
      const name = document.createElement("span");
      number.textContent = `${AppState.currentHistory.length - Math.min(5, AppState.currentHistory.length) + index + 1}回`;
      name.textContent = `${item.guestName ? `${item.guestName}様 / ` : ""}${item.name}`;
      li.append(number, name);
      els.historyList.appendChild(li);
    });
  }

  function renderAdmin() {
    const maids = getMaidList();
    els.maidCount.textContent = `${maids.length}人`;
    els.adminDrawCount.textContent = `${AppState.currentHistory.length}回`;
    els.adminGuestName.textContent = AppState.currentGuestName || "未入力";
    els.pendingSyncCount.textContent = `${AppState.pendingLogs.length}件`;
    els.soundToggle.checked = AppState.soundEnabled;
    els.skipToggle.checked = AppState.skipAvailable;
    els.spreadsheetToggle.checked = AppState.spreadsheetEnabled;
    els.spreadsheetUrlInput.value = AppState.spreadsheetEndpointUrl;
    els.deviceNameInput.value = AppState.deviceName;
    els.maidList.replaceChildren();
    maids.forEach((maid) => {
      const row = document.createElement("div");
      row.textContent = `${maid.id || "-"} / ${maid.name}`;
      els.maidList.appendChild(row);
    });
  }

  function getMaidList() {
    if (!Array.isArray(window.maidConfig) && typeof maidConfig === "undefined") return [];
    return window.maidConfig || maidConfig || [];
  }

  function showScreen(name) {
    els.app.dataset.screen = name;
    window.scrollTo(0, 0);
    els.idleScreen.classList.toggle("is-active", name === "idle");
    els.resultScreen.classList.toggle("is-active", name === "result");
  }

  function resetToIdle() {
    cleanupAnimation();
    AppState.screen = "idle";
    AppState.isAnimating = false;
    AppState.selectedMaid = null;
    AppState.resultSaved = false;
    showScreen("idle");
    unlockControls();
    renderHistory();
  }

  function lockControls() {
    els.gachaButton.disabled = true;
    els.againButton.disabled = true;
    els.nextGuestButton.disabled = true;
  }

  function unlockControls() {
    els.gachaButton.disabled = false;
    els.againButton.disabled = false;
    els.nextGuestButton.disabled = false;
  }

  function unlockResultControls() {
    els.againButton.disabled = false;
    els.nextGuestButton.disabled = false;
  }

  function requestSkip() {
    if (!AppState.isAnimating || !AppState.skipAvailable) return;
    AppState.skipRequested = true;
    els.skipButton.classList.remove("is-visible");
  }

  function shouldSkip() {
    return AppState.skipRequested;
  }

  function scheduleSkipButton() {
    els.skipButton.classList.remove("is-visible");
    if (!AppState.skipAvailable) return;
    const timer = window.setTimeout(() => {
      if (AppState.isAnimating && AppState.screen === "animating") {
        els.skipButton.classList.add("is-visible");
      }
    }, 1000);
    AppState.timers.push(timer);
  }

  function cleanupAnimation() {
    AppState.timers.forEach((timer) => window.clearTimeout(timer));
    AppState.timers = [];
    [
      els.machineHandle, els.gachaMachine, els.dropCapsule, els.focusCapsule,
      els.focusMaid, els.focusMessage, els.flash
    ].forEach((el) => el.className = el.className.replace(/\bis-[\w-]+/g, "").trim());
    els.focusLayer.classList.remove("is-active");
    els.capsuleField.classList.remove("is-mixing");
    els.skipButton.classList.remove("is-visible");
    document.body.classList.remove("is-screen-shaking");
    els.particleLayer.replaceChildren();
  }

  function createWindowCapsules() {
    els.capsuleField.replaceChildren();
    const positions = [
      [4, 40], [18, 55], [33, 42], [52, 56], [65, 37], [74, 58],
      [12, 20], [30, 22], [49, 18], [62, 22], [40, 65], [22, 72]
    ];
    positions.forEach((pos, index) => {
      const capsule = document.createElement("div");
      capsule.className = "window-capsule";
      setCapsuleColors(capsule, index);
      capsule.style.setProperty("--x", `${pos[0]}%`);
      capsule.style.setProperty("--y", `${pos[1]}%`);
      capsule.style.setProperty("--r", `${random(-34, 34)}deg`);
      capsule.style.setProperty("--float-x", `${random(-9, 9)}px`);
      capsule.style.setProperty("--float-y", `${random(5, 18)}px`);
      capsule.style.setProperty("--float-r", `${random(-10, 10)}deg`);
      capsule.style.setProperty("--hop", `${index % 4 === 0 ? random(5, 14) : 0}px`);
      capsule.style.setProperty("--dur", `${random(3.2, 5.8)}s`);
      capsule.style.setProperty("--delay", `${random(-4, 0)}s`);
      capsule.style.setProperty("--mix-x", `${random(-36, 36)}px`);
      capsule.style.setProperty("--mix-y", `${random(22, 58)}px`);
      capsule.style.setProperty("--mix-r", `${random(45, 160)}deg`);
      capsule.style.setProperty("--mix-delay", `${random(-.4, 0)}s`);
      els.capsuleField.appendChild(capsule);
    });
  }

  function setCapsuleColors(el, seed) {
    const pair = capsulePalette[Math.abs(seed ?? Math.floor(Math.random() * capsulePalette.length)) % capsulePalette.length];
    el.style.setProperty("--cap-a", pair[0]);
    el.style.setProperty("--cap-b", pair[1]);
  }

  function emitParticles(count, mode) {
    const limit = Math.min(count, 48);
    const types = ["heart", "star", "confetti"];
    for (let i = 0; i < limit; i += 1) {
      const p = document.createElement("i");
      const type = types[i % types.length];
      p.className = `particle ${type}`;
      const centerX = mode === "fall" ? random(8, 92) : random(38, 62);
      const centerY = mode === "fall" ? random(-4, 30) : random(38, 58);
      p.style.setProperty("--x", `${centerX}%`);
      p.style.setProperty("--y", `${centerY}%`);
      p.style.setProperty("--dx", `${random(-220, 220)}px`);
      p.style.setProperty("--dy", `${mode === "fall" ? random(250, 620) : random(-220, 230)}px`);
      p.style.setProperty("--rot", `${random(-540, 540)}deg`);
      p.style.setProperty("--size", `${random(9, 24)}px`);
      p.style.setProperty("--life", `${random(.8, 1.7)}s`);
      p.style.setProperty("--color", ["#fff", "#ffd94d", "#ff6fa8", "#8edbff"][i % 4]);
      els.particleLayer.appendChild(p);
      window.setTimeout(() => p.remove(), 1800);
    }
  }

  function prepareMaidImage(img, placeholder, maid) {
    placeholder.textContent = `${displayName(maid)}`;
    placeholder.style.display = "none";
    img.style.display = "block";
    img.alt = `${displayName(maid)}のアクキー`;
    img.onload = () => {
      img.style.display = "block";
      placeholder.style.display = "none";
    };
    img.onerror = () => {
      img.style.display = "none";
      placeholder.style.display = "grid";
    };
    img.src = maid.image || "";
  }

  function applyImageFallbacks() {
    document.querySelectorAll(".image-fallback").forEach((el) => {
      const src = el.dataset.img;
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        el.style.backgroundImage = `url("${src}")`;
        el.style.backgroundSize = "contain";
        el.style.backgroundRepeat = "no-repeat";
        el.style.backgroundPosition = "center";
        el.style.border = "0";
        el.style.boxShadow = "none";
      };
      img.src = src;
    });
  }

  function playSound(name) {
    if (!AppState.soundEnabled) return;
    const src = soundFiles[name];
    if (!src || missingSoundFiles.has(src)) {
      playSyntheticSound(name);
      return;
    }

    let usedFallback = false;
    const fallback = () => {
      if (usedFallback) return;
      usedFallback = true;
      missingSoundFiles.add(src);
      playSyntheticSound(name);
    };

    try {
      const audio = new Audio(src);
      audio.volume = .72;
      audio.preload = "auto";
      audio.addEventListener("error", fallback, { once: true });
      const promise = audio.play();
      if (promise && promise.catch) promise.catch(fallback);
    } catch {
      fallback();
    }
  }

  function getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!AppState.audioContext) AppState.audioContext = new AudioContextClass();
    if (AppState.audioContext.state === "suspended") {
      AppState.audioContext.resume().catch(() => {});
    }
    return AppState.audioContext;
  }

  function unlockAudio() {
    if (!AppState.soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = .0001;
    gain.connect(ctx.destination);
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(gain);
    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + .01);
    window.setTimeout(() => gain.disconnect(), 50);
  }

  function playSyntheticSound(name) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      if (name === "tap") {
        playTone(ctx, now, .045, 720, 980, "triangle", .18);
      } else if (name === "gacha_start") {
        playTone(ctx, now, 1.18, 110, 260, "sawtooth", .12);
        for (let i = 0; i < 8; i += 1) playTone(ctx, now + i * .14, .055, 180 + i * 18, 150 + i * 18, "square", .07);
      } else if (name === "click") {
        playTone(ctx, now, .035, 1040, 520, "square", .16);
      } else if (name === "capsule_drop") {
        playTone(ctx, now, .38, 520, 170, "triangle", .13);
      } else if (name === "hit") {
        playNoise(ctx, now, .12, .22);
        playTone(ctx, now, .1, 120, 70, "sine", .14);
      } else if (name === "charge") {
        playTone(ctx, now, .52, 90, 150, "sine", .16);
      } else if (name === "capsule_open") {
        playTone(ctx, now, .16, 320, 900, "triangle", .2);
        playNoise(ctx, now + .02, .18, .16);
      } else if (name === "sparkle") {
        [880, 1175, 1568].forEach((freq, index) => playTone(ctx, now + index * .07, .18, freq, freq * 1.25, "sine", .1));
      } else if (name === "result") {
        [523, 659, 784, 1046].forEach((freq, index) => playTone(ctx, now + index * .09, .22, freq, freq, "triangle", .12));
      }
    } catch {}
  }

  function playTone(ctx, start, duration, fromFreq, toFreq, type, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, toFreq), start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + .02);
  }

  function playNoise(ctx, start, duration, volume) {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + duration);
  }

  function updateSoundSetting() {
    AppState.soundEnabled = els.soundToggle.checked;
    localStorage.setItem(STORAGE_SOUND, AppState.soundEnabled ? "on" : "off");
  }

  function updateSkipSetting() {
    AppState.skipAvailable = els.skipToggle.checked;
    localStorage.setItem(STORAGE_SKIP, AppState.skipAvailable ? "on" : "off");
  }

  function loadSpreadsheetSettings() {
    const defaults = getSpreadsheetDefaults();
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_SHEET_SETTINGS) || "{}");
    } catch {
      saved = {};
    }
    AppState.spreadsheetEnabled = Boolean(saved.enabled ?? defaults.enabled);
    AppState.spreadsheetEndpointUrl = String(saved.endpointUrl ?? defaults.endpointUrl ?? "").trim();
    AppState.deviceName = String(saved.deviceName ?? defaults.deviceName ?? "iPad受付").trim() || "iPad受付";
  }

  function getSpreadsheetDefaults() {
    if (window.spreadsheetConfig) {
      return window.spreadsheetConfig;
    }
    if (typeof spreadsheetConfig === "undefined") {
      return { enabled: false, endpointUrl: "", deviceName: "iPad受付" };
    }
    return spreadsheetConfig || { enabled: false, endpointUrl: "", deviceName: "iPad受付" };
  }

  function updateSpreadsheetEnabled() {
    AppState.spreadsheetEnabled = els.spreadsheetToggle.checked;
    persistSpreadsheetSettings();
    if (AppState.spreadsheetEnabled) {
      queueUnsyncedHistory();
      retryPendingLogs();
    }
  }

  function saveSpreadsheetSettings() {
    AppState.spreadsheetEnabled = els.spreadsheetToggle.checked;
    AppState.spreadsheetEndpointUrl = els.spreadsheetUrlInput.value.trim();
    AppState.deviceName = els.deviceNameInput.value.trim() || "iPad受付";
    persistSpreadsheetSettings();
    renderAdmin();
    if (AppState.spreadsheetEnabled) {
      queueUnsyncedHistory();
      retryPendingLogs();
    }
    alert("スプレッドシート連携設定を保存しました。");
  }

  function persistSpreadsheetSettings() {
    localStorage.setItem(STORAGE_SHEET_SETTINGS, JSON.stringify({
      enabled: AppState.spreadsheetEnabled,
      endpointUrl: AppState.spreadsheetEndpointUrl,
      deviceName: AppState.deviceName
    }));
  }

  function queueSpreadsheetResult(result) {
    if (!AppState.spreadsheetEnabled || !AppState.spreadsheetEndpointUrl) {
      renderAdmin();
      return;
    }
    if (!AppState.pendingLogs.some((item) => item.resultId === result.resultId)) {
      AppState.pendingLogs.push(result);
      persistPendingLogs();
    }
    sendSpreadsheetResult(result);
  }

  function queueUnsyncedHistory() {
    if (!AppState.spreadsheetEndpointUrl) return;
    AppState.currentHistory
      .filter((item) => item.resultId && !item.synced)
      .forEach((item) => {
        if (!AppState.pendingLogs.some((pending) => pending.resultId === item.resultId)) {
          AppState.pendingLogs.push(item);
        }
      });
    persistPendingLogs();
    renderAdmin();
  }

  async function retryPendingLogs() {
    if (!AppState.spreadsheetEnabled || !AppState.spreadsheetEndpointUrl || AppState.pendingLogs.length === 0) {
      renderAdmin();
      return;
    }
    const pending = [...AppState.pendingLogs];
    for (const item of pending) {
      await sendSpreadsheetResult(item);
    }
  }

  async function sendSpreadsheetResult(result) {
    if (!AppState.spreadsheetEnabled || !AppState.spreadsheetEndpointUrl || !result) return;
    const payload = {
      resultId: result.resultId,
      timestamp: result.at,
      guestName: result.guestName || "未入力",
      maidId: result.id || "",
      maidName: result.name || "",
      drawNumber: result.drawNumber || "",
      deviceName: result.deviceName || AppState.deviceName || "",
      userAgent: navigator.userAgent
    };

    try {
      const body = new URLSearchParams();
      body.set("payload", JSON.stringify(payload));
      await fetch(AppState.spreadsheetEndpointUrl, {
        method: "POST",
        mode: "no-cors",
        body
      });
      markResultSynced(result.resultId);
    } catch (error) {
      console.warn("Spreadsheet sync failed", error);
    } finally {
      renderAdmin();
    }
  }

  function markResultSynced(resultId) {
    AppState.pendingLogs = AppState.pendingLogs.filter((item) => item.resultId !== resultId);
    AppState.currentHistory = AppState.currentHistory.map((item) => {
      if (item.resultId !== resultId) return item;
      return { ...item, synced: true };
    });
    persistPendingLogs();
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(AppState.currentHistory));
  }

  function persistPendingLogs() {
    localStorage.setItem(STORAGE_PENDING_LOGS, JSON.stringify(AppState.pendingLogs));
  }

  function createResultId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function confirmNextGuest() {
    if (AppState.isAnimating) return;
    if (AppState.currentHistory.length === 0) return resetToIdle();
    if (typeof els.confirmDialog.showModal === "function") {
      els.confirmDialog.showModal();
    } else if (confirm("現在のガチャ履歴を削除して、次のご主人様のガチャを開始しますか？")) {
      clearHistory();
      resetToIdle();
    }
  }

  function openAdmin() {
    renderAdmin();
    els.adminPanel.classList.add("is-active");
  }

  function updateOrientation() {
    document.documentElement.style.setProperty("--vh", `${window.innerHeight}px`);
    document.body.classList.toggle("is-landscape", isLandscape());
  }

  function isLandscape() {
    return window.innerWidth > window.innerHeight;
  }

  function resetAnimationClass(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  function displayName(maid) {
    const name = (maid && maid.name ? maid.name : "メイドさん").trim();
    return name.endsWith("ちゃん") ? name : `${name}ちゃん`;
  }

  function random(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  }
})();
