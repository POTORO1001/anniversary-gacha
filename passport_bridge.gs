// Add this file to the SAME Apps Script project as google_apps_script.gs.
// Credentials belong in Script Properties, never in the web app or GitHub.
const GOODS_SPREADSHEET_ID = "1KXxFLRzHtEj1qSJ1HWDhPts-vjmzQe2EV1aLRzNhq9A";
const PASSPORT_ORIGIN = "https://potoro-passport.vercel.app";
const GOODS_HEADERS = ["管理ID", "対象区分", "会員番号", "ハンドルネーム", "グッズ名", "数量", "メモ", "ステータス", "登録日", "受取日", "同期状態", "同期日時", "エラー内容"];

function property_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error("Apps Scriptの設定が不足しています: " + name);
  return value;
}

function requireKioskKey_(key) {
  const expected = property_("GACHA_KIOSK_KEY");
  if (expected.length < 16 || !key || key !== expected) throw new Error("会員受付キーを確認してください。");
}

function signingSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("GACHA_SIGNING_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("GACHA_SIGNING_SECRET", secret);
  }
  return secret;
}

function signMember_(body) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, signingSecret_()));
}

function lookupPassportMember_(qr) {
  const value = String(qr || "").trim();
  if (!value || value.length > 512) throw new Error("会員証のQRコードを読み取ってください。");
  const member = findPassportMember_("qr_identifier", value);
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(member), Utilities.Charset.UTF_8);
  return { memberNumber: member.memberNumber, displayName: member.displayName, memberToken: body + "." + signMember_(body) };
}

function findPassportMember_(column, value) {
  const origin = property_("SUPABASE_URL").replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin)) throw new Error("SUPABASE_URLを確認してください。");
  const key = property_("SUPABASE_SERVICE_ROLE_KEY");
  const response = UrlFetchApp.fetch(origin + "/rest/v1/members?select=member_number,display_name&status=eq.active&" + column + "=eq." + encodeURIComponent(value) + "&limit=2", {
    headers: { apikey: key, Authorization: "Bearer " + key }, muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error("パスポートの会員情報に接続できませんでした。");
  const rows = JSON.parse(response.getContentText());
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("有効な会員証が見つかりません。スタッフにお声がけください。");
  return { memberNumber: rows[0].member_number, displayName: rows[0].display_name };
}

function verifyMemberToken_(token) {
  if (typeof token !== "string" || token.length > 4096) throw new Error("会員証を読み取り直してください。");
  const parts = token.split(".");
  if (parts.length !== 2 || signMember_(parts[0]) !== parts[1]) throw new Error("会員証を読み取り直してください。");
  const member = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString("UTF-8"));
  if (!member.memberNumber || !member.displayName) throw new Error("会員情報が不正です。");
  return member;
}

function getGachaMaid_(id) {
  const raw = PropertiesService.getScriptProperties().getProperty("GACHA_MAIDS_JSON");
  const maids = raw ? JSON.parse(raw) : [{ id: "maid01", name: "ひなた" }, { id: "maid02", name: "みるく" }];
  const maid = maids.find(item => item.id === id && item.name);
  if (!maid) throw new Error("Apps Scriptのメイド設定を確認してください。");
  return maid;
}

function safeCell_(value) {
  const text = String(value || "").slice(0, 2000);
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

function registerGachaGoods_(payload, member) {
  const sheet = SpreadsheetApp.openById(GOODS_SPREADSHEET_ID).getSheetByName("グッズ管理");
  if (!sheet) throw new Error("グッズ管理シートが見つかりません。");
  const headers = sheet.getRange(1, 1, 1, 13).getValues()[0];
  if (headers.some((value, i) => value !== GOODS_HEADERS[i])) throw new Error("グッズ管理シートの列構成が変更されています。");
  const managementId = "GACHA-" + payload.resultId;
  const name = "周年アクキー / " + payload.maidName;
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => row[0]) : [];
  const existing = ids.indexOf(managementId);
  let rowNumber;
  if (existing >= 0) {
    rowNumber = existing + 2;
    const row = sheet.getRange(rowNumber, 1, 1, 13).getValues()[0];
    if (row[2] !== member.memberNumber || row[4] !== name) throw new Error("抽選IDの記録内容が一致しません。スタッフが確認してください。");
    if (row[10] === "同期済み") return;
  } else {
    const active = findPassportMember_("member_number", member.memberNumber);
    rowNumber = lastRow + 1;
    sheet.getRange(rowNumber, 1, 1, 13).setValues([[
      managementId, "会員", active.memberNumber, safeCell_(active.displayName), safeCell_(name), 1,
      "周年イベント アクキーガチャ", "未受取", new Date(), "", "送信待ち", "", ""
    ]]);
    SpreadsheetApp.flush();
  }
  // Read the current row on retries: never reset a received/canceled item to unreceived.
  const row = sheet.getRange(rowNumber, 1, 1, 13).getValues()[0];
  try {
    const response = UrlFetchApp.fetch(PASSPORT_ORIGIN + "/api/google-sheets/goods-sync", {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      payload: JSON.stringify({ secret: property_("GOOGLE_SHEETS_WEBHOOK_SECRET"), rows: [{
        rowNumber: rowNumber, managementId: row[0], targetType: row[1], memberNumber: row[2],
        displayName: row[3], name: row[4], quantity: row[5], note: row[6], status: row[7],
        registeredAt: row[8], receivedAt: row[9]
      }] })
    });
    const body = JSON.parse(response.getContentText() || "{}");
    const result = body.results && body.results[0];
    if (response.getResponseCode() !== 200 || !body.ok || !result || result.syncStatus !== "同期済み" || result.error || result.managementId !== managementId) {
      throw new Error("パスポートへの同期が未完了です。連携設定を確認して再送してください。");
    }
    sheet.getRange(rowNumber, 11, 1, 3).setValues([["同期済み", new Date(), ""]]);
    SpreadsheetApp.flush();
  } catch (error) {
    sheet.getRange(rowNumber, 11, 1, 3).setValues([["エラー", new Date(), "パスポート同期が未完了です。再送してください。"]]);
    throw new Error("グッズ管理には記録済みですが、パスポート同期が未完了です。再送してください。");
  }
}
