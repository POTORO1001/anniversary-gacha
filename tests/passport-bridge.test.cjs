const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');

function sheet(rows) {
  return {
    rows,
    getLastRow: () => rows.length,
    appendRow: row => rows.push(row),
    setFrozenRows() {},
    getRange(r, c, h = 1, w = 1) {
      return {
        getValues: () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
        setValues(values) { values.forEach((row, i) => row.forEach((v, j) => { rows[r - 1 + i] ??= []; rows[r - 1 + i][c - 1 + j] = v; })); }
      };
    }
  };
}

function setup() {
  const key = 'test-kiosk-key-with-length';
  const props = new Map(Object.entries({ GACHA_KIOSK_KEY: key, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only', GOOGLE_SHEETS_WEBHOOK_SECRET: 'sync-secret' }));
  const log = sheet([]);
  const goods = sheet([['管理ID','対象区分','会員番号','ハンドルネーム','グッズ名','数量','メモ','ステータス','登録日','受取日','同期状態','同期日時','エラー内容']]);
  const calls = [];
  let fail = false;
  const ctx = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k), setProperty: (k,v) => props.set(k,v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { Charset: { UTF_8: 'utf8' }, getUuid: crypto.randomUUID,
      base64EncodeWebSafe: v => Buffer.from(v).toString('base64url'), base64DecodeWebSafe: v => Buffer.from(v,'base64url'),
      computeHmacSha256Signature: (v,k) => crypto.createHmac('sha256',k).update(v).digest(),
      newBlob: v => ({ getDataAsString: () => Buffer.from(v).toString('utf8') }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => log }), openById: () => ({ getSheetByName: () => goods }), flush() {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType: () => JSON.parse(value) }) },
    UrlFetchApp: { fetch(url, options) {
      const data = url.includes('/rest/v1/') ? [{ member_number: 'P000001', display_name: 'テスト会員' }]
        : (() => { const body = JSON.parse(options.payload); calls.push(body.rows[0]); return fail ? { ok:false } : { ok:true, results:[{...body.rows[0],syncStatus:'同期済み'}] }; })();
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(data) };
    } }
  });
  for (const file of ['passport_bridge.gs','google_apps_script.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), ctx);
  const post = payload => ctx.doPost({ parameter: { payload: JSON.stringify(payload) } });
  const member = () => post({ action:'passport.lookup', kioskKey:key, qrIdentifier:'test-qr' }).member;
  const payload = () => ({ resultId:crypto.randomUUID(), memberToken:member().memberToken, kioskKey:key, maidId:'meru', maidName:'tampered client name', guestName:'tampered client guest' });
  return {post,member,payload,log,goods,calls,setFail:v=>{fail=v;}};
}

test('member lookup requires kiosk key; signed tokens reject tampering',()=>{
  const s=setup(); assert.equal(s.post({action:'passport.lookup',qrIdentifier:'test'}).ok,false);
  const p=s.payload(); p.memberToken+='invalid'; assert.equal(s.post(p).ok,false); assert.equal(s.goods.rows.length,1);
});
test('member result uses server names and saves exactly once',()=>{
  const s=setup(), p=s.payload(); assert.equal(s.post(p).ok,true); assert.equal(s.post(p).ok,true);
  assert.equal(s.goods.rows.length,2); assert.equal(s.log.rows.length,2); assert.equal(s.calls.length,1);
  assert.equal(s.goods.rows[1][4],'周年アクキー / める'); assert.equal(s.goods.rows[1][7],'未受取'); assert.equal(s.goods.rows[1][10],'同期済み');
});
test('partial failure retries existing row and preserves received status',()=>{
  const s=setup(), p=s.payload(); s.setFail(true); assert.equal(s.post(p).ok,false);
  assert.equal(s.goods.rows[1][10],'エラー'); s.goods.rows[1][7]='受取済み';
  s.setFail(false); assert.equal(s.post(p).ok,true); assert.equal(s.goods.rows.length,2); assert.equal(s.log.rows.length,2);
  assert.equal(s.calls[1].status,'受取済み'); assert.equal(s.goods.rows[1][7],'受取済み');
});
test('guest result never writes goods; unknown maid never grants goods',()=>{
  const s=setup(); assert.equal(s.post({resultId:crypto.randomUUID(),guestName:'Guest',maidId:'meru'}).ok,true);
  assert.equal(s.goods.rows.length,1); const p=s.payload(); p.maidId='unknown'; assert.equal(s.post(p).ok,false);
  assert.equal(s.goods.rows.length,1);
});
