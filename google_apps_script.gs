const SHEET_NAME = "ガチャ結果";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = parsePayload_(e);
    if (payload.action === "passport.lookup") {
      requireKioskKey_(payload.kioskKey);
      return json_({ ok: true, member: lookupPassportMember_(payload.qrIdentifier) });
    }
    const sheet = getResultSheet_();

    if (!/^[A-Za-z0-9_-]{8,100}$/.test(String(payload.resultId || ""))) {
      throw new Error("resultId is required");
    }

    let member = null;
    if (payload.memberToken) {
      requireKioskKey_(payload.kioskKey);
      member = verifyMemberToken_(payload.memberToken);
      const maid = getGachaMaid_(payload.maidId);
      payload.maidName = maid.name;
      payload.guestName = member.displayName;
    }
    const duplicate = isDuplicate_(sheet, payload.resultId);
    if (!duplicate) sheet.appendRow([
      payload.resultId,
      payload.timestamp || new Date().toISOString(),
      safeCell_(payload.guestName),
      safeCell_(payload.maidId),
      safeCell_(payload.maidName),
      payload.drawNumber || "",
      safeCell_(payload.deviceName),
      safeCell_(payload.userAgent)
    ]);
    if (member) registerGachaGoods_(payload, member);
    return json_({ ok: true, duplicate: duplicate, goodsSynced: Boolean(member) });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  getResultSheet_();
  return json_({ ok: true, message: "Gacha logger is ready." });
}

function getResultSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "resultId",
      "日時",
      "ご主人様名",
      "メイドID",
      "当選メイド",
      "回数",
      "端末名",
      "UserAgent"
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function parsePayload_(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  return {};
}

function isDuplicate_(sheet, resultId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  return ids.includes(resultId);
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
