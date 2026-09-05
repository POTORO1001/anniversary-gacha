const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  assert(process.env.QR_IMAGE, 'Set QR_IMAGE to a test member QR image (never commit it).');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    const errors = [];
    const sent = [];
    let fail = true;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://script.google.com/macros/s/test/exec', async route => {
      const payload = JSON.parse(new URLSearchParams(route.request().postData()).get('payload'));
      if (payload.action === 'passport.lookup') {
        assert(payload.qrIdentifier.length > 10);
        await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { ok: true, member: { memberNumber: 'P000001', displayName: 'テスト会員', memberToken: 'test-token' } } });
      } else {
        sent.push(payload);
        await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: fail ? { ok: false, error: 'テスト通信失敗' } : { ok: true, goodsSynced: Boolean(payload.memberToken) } });
      }
    });
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('maidGachaSpreadsheetSettings', JSON.stringify({ enabled: true, endpointUrl: 'https://script.google.com/macros/s/test/exec', deviceName: 'test' }));
      localStorage.setItem('maidGachaBgm', 'off');
      localStorage.setItem('maidGachaSound', 'off');
      sessionStorage.setItem('maidGachaPassportKey', 'test-key');
    });
    await page.reload();
    await page.locator('#gachaButton').click();
    await page.locator('#gachaButton').evaluate(el => { el.click(); el.click(); });
    assert.equal(await page.locator('dialog[open]').count(), 1);
    await page.locator('#passportChoiceDialog button[value="member"]').click();
    await page.locator('#passportScanDialog[open]').waitFor();
    await page.locator('#passportImageInput').setInputFiles(process.env.QR_IMAGE);
    await page.locator('#passportConfirmButton').waitFor({ state: 'visible', timeout: 10000 }).catch(async error => { console.error(await page.locator('#passportScanStatus').textContent()); throw error; });
    assert.match(await page.locator('#passportMemberName').textContent(), /テスト会員/);
    await page.screenshot({ path: path.join(process.env.TEMP || '/tmp', 'passport-confirm.png') });
    await page.locator('#passportConfirmButton').click();
    await page.locator('#skipButton.is-visible').click();
    await page.locator('#resultScreen.is-active').waitFor();
    await page.waitForTimeout(300);
    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaPendingSpreadsheetLogs')));
    assert.equal(pending.length, 1); assert.equal(pending[0].member.memberNumber, 'P000001');
    assert.match(await page.locator('#resultSyncStatus').textContent(), /送信待ち/);
    await page.locator('#againButton').click();
    await page.locator('#nextGuestButton').click();
    await page.locator('#confirmDialog button[value="confirm"]').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaPendingSpreadsheetLogs')).length), 1);
    fail = false;
    for (let i = 0; i < 5; i++) await page.locator('#adminTapTarget').click();
    await page.locator('#retrySyncButton').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('maidGachaPendingSpreadsheetLogs')).length === 0);
    assert.equal(sent[0].resultId, sent[1].resultId);
    assert.equal(sent[0].memberToken, sent[1].memberToken);
    await page.locator('#closeAdminButton').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#gachaButton').click();
    await page.locator('#passportChoiceDialog button[value="guest"]').click();
    await page.locator('#guestNameInput').fill('非会員テスト');
    await page.locator('#guestForm button[value="confirm"]').click();
    await page.locator('#skipButton.is-visible').click();
    await page.locator('#resultScreen.is-active').waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('maidGachaHistory'))[0].synced);
    assert.equal(sent[2].memberToken, '');
    assert.equal(sent[2].guestName, '非会員テスト');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaHistory')).length), 1);
    for (const [width, height] of [[768, 1024], [390, 844], [375, 667]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(320);
      const bottom = await page.locator('#againButton').evaluate(el => el.getBoundingClientRect().bottom);
      assert(bottom <= height, `Result button overflows ${width}x${height}: ${bottom}`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: real QR decoding, member confirmation, reception double-tap guard, skip, failed sync queue, next guest retains pending data, idempotent retry, guest flow');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
