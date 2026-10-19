/* Local textbook-only verification: node e2e/textbooks/verify.cjs */
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEXTBOOK_BASE_URL || 'http://localhost:3214';
const output = path.resolve('artifacts/textbook-v1');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const evidence = { screenshots: [], checks: [], accessibility: [], errors: [] };
  try {
    for (const width of [390, 768, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: true, reducedMotion: 'reduce', bypassCSP: true });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(120000);
      page.setDefaultTimeout(60000);
      page.on('pageerror', error => evidence.errors.push(error.message));
      await page.goto(base + '/pilot-preview/textbooks', { timeout: 120000 });
      await page.getByRole('heading', { name: 'Small parts. Big discoveries.' }).waitFor();
      await page.waitForTimeout(300);
      const dismissCookies = page.getByRole('button', { name: 'Dismiss', exact: true });
      if (await dismissCookies.isVisible()) await dismissCookies.click();
      assert.equal(await page.locator('article').count(), width >= 1100 ? 2 : 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow at ' + width);
      await page.screenshot({ path: path.join(output, `reader-${width}.png`), fullPage: true });
      evidence.screenshots.push(`reader-${width}.png`);
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const axe = await page.evaluate(async () => (await axe.run(document.querySelector('#main-content'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })));
      evidence.accessibility.push({ width, violations: axe });
      assert.equal(axe.length, 0, JSON.stringify(axe));
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      assert.equal(await page.locator('article').first().getAttribute('aria-label'), width >= 1100 ? 'Page 3: Meet the numerator' : 'Page 2: One whole, many possibilities');
      await page.getByRole('button', { name: 'Bookmark', exact: true }).click();
      await page.getByRole('button', { name: 'Bookmarked', exact: true }).waitFor();
      await page.waitForFunction(expected => {
        const saved = JSON.parse(localStorage.getItem('ll:textbook:demo:synthetic-fractions:showcase-v1') || '{}');
        return saved.page === expected && saved.bookmarks?.includes(expected);
      }, width >= 1100 ? 2 : 1);
      await page.reload();
      await page.getByRole('button', { name: 'Bookmarked', exact: true }).waitFor();
      if (width < 1100) await page.getByRole('button', { name: 'Contents', exact: true }).click();
      await page.getByRole('button', { name: /Bookmarks/ }).click();
      assert.equal(await page.getByRole('navigation', { name: 'Bookmarks', exact: true }).getByRole('button').count(), 1);
      await page.getByRole('button', { name: 'Chapters', exact: true }).click();
      if (width < 1100) { await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button', { name: 'Contents', exact: true }).getAttribute('aria-expanded'), 'false'); }
      await page.getByRole('button', { name: 'Increase font size' }).click();
      await page.getByRole('button', { name: 'Increase font size' }).click();
      assert(await page.getByRole('button', { name: 'Increase font size' }).isDisabled());
      await page.getByRole('combobox', { name: 'Layout', exact: true }).selectOption('single');
      assert.equal(await page.locator('article').count(), 1);
      await page.getByRole('region', { name: 'Book pages. Use left and right arrow keys to turn pages.' }).focus();
      await page.keyboard.press('Home');
      await page.getByRole('heading', { name: 'Small parts. Big discoveries.' }).waitFor();
      await page.keyboard.press('ArrowRight');
      await page.getByRole('heading', { name: 'One whole, many possibilities' }).waitFor();
      const tile = page.getByRole('button', { name: 'Part 1 of 4' });
      await tile.click(); assert.equal(await tile.getAttribute('aria-pressed'), 'false');
      await page.getByRole('combobox', { name: 'Equal parts' }).selectOption('2');
      assert.equal(await page.getByRole('button', { name: /Part \d of 2/ }).count(), 2);
      const before = await page.locator('article').first().getAttribute('aria-label');
      await page.getByRole('combobox', { name: 'Equal parts' }).press('ArrowRight');
      assert.equal(await page.locator('article').first().getAttribute('aria-label'), before, 'control arrow hijacked');
      if (width < 1100) { await page.getByRole('button', { name: 'Contents', exact: true }).click(); await page.getByRole('button', { name: /03 Different names/ }).click(); }
      else await page.getByRole('button', { name: /03 Different names/ }).click();
      await page.getByRole('heading', { name: 'A half can have another name' }).waitFor();
      if (width < 1100) {
        await page.locator('article h2').scrollIntoViewIfNeeded();
        const box = await page.locator('article h2').boundingBox();
        const input = await context.newCDPSession(page);
        await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 200, y: box.y + 15 }] });
        await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 50, y: box.y + 16 }] });
        await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await input.detach();
        await page.getByRole('heading', { name: 'Take the idea into your world' }).waitFor();
      }
      await page.locator('article h2').first().focus(); await page.keyboard.press('End');
      assert(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled());
      assert.equal(await page.locator('article').evaluate(el => getComputedStyle(el).animationName), 'none');
      await context.setOffline(true);
      await page.getByText('You are offline. Keep this book open', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      assert(await page.locator('article').count() > 0);
      evidence.checks.push({ width, navigation: 'pass', keyboard: 'pass', controls: 'pass', persistence: 'pass', reducedMotion: 'pass', loadedTextOffline: 'pass', offlineReopening: 'not supported; not claimed' });
      await context.close();
    }
    const context = await browser.newContext(); const page = await context.newPage();
    page.setDefaultNavigationTimeout(120000);
    await page.goto(base + '/student/textbooks'); assert(page.url().includes('/login'));
    await page.goto(base + '/teacher/textbooks/preview'); assert(page.url().includes('/login'));
    evidence.checks.push({ unauthenticatedPortals: 'redirected to login' });
    await context.close();
    const states = await browser.newContext({ bypassCSP: true });
    await states.addInitScript(() => {
      window.__textbookSpeech = [];
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: utterance => { window.__textbookSpeech.push(utterance.text); }, cancel: () => {} } });
    });
    const statePage = await states.newPage(); statePage.setDefaultNavigationTimeout(120000);
    await statePage.goto(base + '/pilot-preview/textbooks?case=unavailable');
    await statePage.getByRole('heading', { name: 'Reading content unavailable' }).waitFor();
    assert(await statePage.getByRole('button', { name: 'Read aloud', exact: true }).isDisabled());
    await statePage.setViewportSize({ width: 1440, height: 1000 });
    await statePage.goto(base + '/pilot-preview/textbooks?case=narrow-frame');
    await statePage.getByRole('heading', { name: 'Small parts. Big discoveries.' }).waitFor();
    await statePage.getByRole('button', { name: 'Contents', exact: true }).waitFor();
    assert.equal(await statePage.locator('article').count(), 1, 'narrow student-shell container must use one page');
    await statePage.goto(base + '/pilot-preview/textbooks?case=missing-asset');
    await statePage.getByText('Illustration unavailable.', { exact: false }).waitFor();
    const stateCookies = statePage.getByRole('button', { name: 'Dismiss', exact: true });
    if (await stateCookies.isVisible()) await stateCookies.click();
    await statePage.getByRole('button', { name: 'Read aloud', exact: true }).click();
    assert.equal(await statePage.getByRole('button', { name: 'Stop reading', exact: true }).getAttribute('aria-pressed'), 'true');
    assert((await statePage.evaluate(() => window.__textbookSpeech[0])).includes('Small parts.'));
    await statePage.getByRole('button', { name: 'Next', exact: true }).click();
    await statePage.getByRole('button', { name: 'Read aloud', exact: true }).waitFor();
    evidence.checks.push({ emptyReading: 'pass', missingAssetTextFallback: 'pass', narrowContainer: 'pass', browserSpeechLifecycle: 'pass with synthetic speech adapter; real voice playback not certified' });
    await states.close();
    const visual = await browser.newContext({ bypassCSP: true });
    const fixturePage = await visual.newPage();
    fixturePage.setDefaultNavigationTimeout(120000);
    await fixturePage.goto(base + '/pilot-preview/textbooks');
    const css = await fixturePage.locator('style,link[rel=stylesheet]').evaluateAll(nodes => nodes.map(n => n.outerHTML).join('\n'));
    for (const width of [390, 768, 1440, 1920]) {
      await fixturePage.setViewportSize({ width, height: 1000 });
      for (const phase of ['before', 'after']) {
        await fixturePage.setContent('<html><head>' + css + '</head><body>' + fs.readFileSync(path.join(output, `hub-${phase}.html`), 'utf8') + '</body></html>');
        await fixturePage.screenshot({ path: path.join(output, `hub-${phase}-fixture-${width}.png`), fullPage: true });
        evidence.screenshots.push(`hub-${phase}-fixture-${width}.png`);
      }
    }
    await visual.close();
    assert.equal(evidence.errors.length, 0, evidence.errors.join('\n'));
  } finally { fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(evidence, null, 2)); await browser.close(); }
  process.stdout.write(JSON.stringify(evidence, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
