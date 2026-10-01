const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => new MediaStream() }
      });
      HTMLMediaElement.prototype.play = async function () {
        Object.defineProperties(this, {
          readyState: { configurable: true, value: 4 },
          videoWidth: { configurable: true, value: 640 },
          videoHeight: { configurable: true, value: 480 }
        });
      };
      HTMLCanvasElement.prototype.getContext = () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) })
      });
    });
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
    const addedMaids = await page.evaluate(async () => {
      const results = {};
      for (const id of ['koguma', 'nagi', 'oumasan']) {
        const maid = window.maidConfig.find(item => item.id === id);
        if (!maid) continue;
        const loaded = await new Promise(resolve => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve(null);
          img.src = maid.image;
        });
        results[id] = { maid, loaded };
      }
      return { results, count: window.maidConfig.length };
    });
    assert.equal(addedMaids.count, 9);
    assert.deepEqual(addedMaids.results.koguma, { maid: { id: 'koguma', name: 'こぐま', image: 'img/maids/koguma.png' }, loaded: { width: 832, height: 1703 } });
    assert.deepEqual(addedMaids.results.nagi, { maid: { id: 'nagi', name: 'なぎ', image: 'img/maids/nagi.png' }, loaded: { width: 932, height: 1688 } });
    assert.deepEqual(addedMaids.results.oumasan, { maid: { id: 'oumasan', name: 'おうまさん', image: 'img/maids/oumasan.png', chancePercent: 5 }, loaded: { width: 1002, height: 1448 } });
    await page.evaluate(() => { window.jsQR = () => ({ data: 'camera-test-qr-value' }); });
    await page.locator('#receptionButton').click();
    await page.locator('#receptionButton').evaluate(el => { el.click(); el.click(); });
    assert.equal(await page.locator('dialog[open]').count(), 1);
    assert.equal(await page.locator('#paymentConfirmDialog[open]').count(), 1);
    assert.match(await page.locator('#paymentConfirmDialog').textContent(), /前金制/);
    assert.match(await page.locator('#paymentConfirmDialog').textContent(), /1,000円を頂戴しました/);
    await page.screenshot({ path: path.join(process.env.TEMP || '/tmp', 'gacha-payment-confirm.png') });
    await page.locator('#paymentConfirmDialog button[value="confirm"]').click();
    await page.locator('#passportChoiceDialog[open]').waitFor();
    await page.locator('#passportChoiceDialog button[value="member"]').click();
    await page.locator('#passportScanDialog[open]').waitFor();
    assert.equal(await page.locator('#passportImageInput').count(), 0);
    await page.locator('#passportCameraButton').click();
    await page.locator('#passportConfirmButton').waitFor({ state: 'visible', timeout: 10000 }).catch(async error => { console.error(await page.locator('#passportScanStatus').textContent()); throw error; });
    assert.match(await page.locator('#passportMemberName').textContent(), /テスト会員/);
    assert.equal(await page.locator('#passportConfirmButton').textContent(), 'このご主人様で受付を完了');
    await page.screenshot({ path: path.join(process.env.TEMP || '/tmp', 'passport-confirm.png') });
    await page.locator('#passportConfirmButton').click();
    await page.locator('#drawReadyPanel:not([hidden])').waitFor();
    assert.match(await page.locator('#drawReadyGuest').textContent(), /テスト会員様/);
    assert.equal(await page.locator('#gachaButton').getAttribute('aria-label'), 'ガチャを回す');
    const readyButtonBox = await page.locator('#gachaButton').boundingBox();
    assert(readyButtonBox.width >= 140 && readyButtonBox.height >= 140);
    await page.screenshot({ path: path.join(process.env.TEMP || '/tmp', 'gacha-ready-button.png') });
    await page.locator('#gachaButton').click();
    await page.locator('#skipButton.is-visible').click();
    await page.locator('#resultScreen.is-active').waitFor();
    await page.waitForTimeout(300);
    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaPendingSpreadsheetLogs')));
    assert.equal(pending.length, 1); assert.equal(pending[0].member.memberNumber, 'P000001');
    assert.equal(await page.locator('#resultSyncStatus').textContent(), '');
    await page.locator('#againButton').click();
    await page.locator('#paymentConfirmDialog[open]').waitFor();
    assert.equal(await page.locator('#maidImage').getAttribute('src'), null);
    assert.equal(await page.locator('#maidImage').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator('#focusMaidImage').getAttribute('src'), null);
    await page.locator('#paymentConfirmDialog button[value="confirm"]').click();
    await page.locator('#drawReadyPanel:not([hidden])').waitFor();
    assert.equal(await page.locator('#gachaButton').isDisabled(), true);
    await page.locator('#gachaButton').evaluate(el => el.click());
    assert.equal(await page.locator('#app').getAttribute('data-screen'), 'idle');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaHistory')).length), 1);
    await page.locator('#gachaButton:not([disabled])').waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaHistory')).length), 1);
    await page.locator('#nextGuestButton').click();
    await page.locator('#confirmDialog button[value="confirm"]').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaPendingSpreadsheetLogs')).length), 1);
    fail = false;
    for (let i = 0; i < 5; i++) await page.locator('#adminTapTarget').click();
    const maidRates = await page.locator('#maidList > div').allTextContents();
    assert(maidRates.includes('oumasan / おうまさん / 5%'));
    assert(maidRates.includes('meru / める / 11.875%'));
    assert.equal(maidRates.filter(row => row.endsWith('/ 11.875%')).length, 8);
    await page.screenshot({ path: path.join(process.env.TEMP || '/tmp', 'gacha-admin-rates.png') });
    await page.locator('#retrySyncButton').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('maidGachaPendingSpreadsheetLogs')).length === 0);
    assert.equal(sent[0].resultId, sent[1].resultId);
    assert.equal(sent[0].memberToken, sent[1].memberToken);
    await page.locator('#closeAdminButton').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#receptionButton').click();
    await page.locator('#paymentConfirmDialog button[value="confirm"]').click();
    await page.locator('#passportChoiceDialog button[value="guest"]').click();
    await page.locator('#guestNameInput').fill('非会員テスト');
    assert.equal(await page.locator('#guestForm button[value="confirm"]').textContent(), 'この名前で受付を完了');
    await page.locator('#guestForm button[value="confirm"]').click();
    await page.locator('#drawReadyPanel:not([hidden])').waitFor();
    await page.evaluate(() => { Math.random = () => .99; });
    await page.locator('#gachaButton').click();
    await page.locator('#skipButton.is-visible').click();
    await page.locator('#resultScreen.is-active').waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('maidGachaHistory'))[0].synced);
    assert.equal(await page.locator('#againButton').textContent(), '同じご主人様がもう一度ガチャを回す');
    assert.equal(await page.locator('#endButton').textContent(), '終了する');
    assert.equal(sent[2].memberToken, '');
    assert.equal(sent[2].guestName, '非会員テスト');
    assert.equal(sent[2].maidId, 'oumasan');
    assert.match(await page.locator('#resultMessage').textContent(), /おうまさん/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaHistory')).length), 1);
    for (const [width, height] of [[768, 1024], [390, 844], [375, 667]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(320);
      const bottom = await page.locator('#againButton').evaluate(el => el.getBoundingClientRect().bottom);
      assert(bottom <= height, `Result button overflows ${width}x${height}: ${bottom}`);
    }
    await page.locator('#endButton').click();
    assert.equal(await page.locator('#app').getAttribute('data-screen'), 'idle');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('maidGachaHistory') || '[]').length), 0);
    assert.equal(await page.locator('#guestNameLabel').textContent(), 'ご主人様: 未入力');
    assert.deepEqual(errors, []);
    console.log('PASS: added maid assets, stale result images cleared, payment-first confirmation, repeat payment does not auto-draw, touch-through guard, camera-only member confirmation, reception double-tap guard, skip, failed sync queue, next guest retains pending data, idempotent retry, guest flow');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
