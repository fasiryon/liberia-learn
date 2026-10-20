import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const out = 'artifacts/joint-repairs';
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'scripts/joint-repairs/vite.config.ts' });
await server.listen();
const browser = await chromium.launch();
const results = [];
async function activate(page, button) { await button.focus(); await page.keyboard.press('Enter'); }
try {
  for (const width of [390, 768, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    const errors = [], posts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
    const go = async query => { await page.goto(`http://127.0.0.1:3186/student/lesson/review-native?${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); };
    await go('mode=heading');
    await page.getByRole('heading', { name: 'Opening', exact: true }).waitFor();
    for (const mode of ['empty', 'changed']) {
      await go(`mode=${mode}`);
      const bookmark = page.getByRole('button', { name: 'Bookmark', exact: true });
      await bookmark.waitFor();
      if (mode === 'changed') {
        await activate(page, bookmark);
        await page.getByRole('button', { name: 'Bookmarked', exact: true }).waitFor();
        const contents = page.getByRole('button', { name: 'Contents', exact: true });
        if (await contents.isVisible() && await contents.getAttribute('aria-expanded') === 'false') await activate(page, contents);
        await activate(page, page.getByRole('button', { name: /^Bookmarks/ }));
        assert((await page.getByRole('navigation', { name: 'Bookmarks', exact: true }).textContent()).includes('First page'));
        await activate(page, page.getByRole('button', { name: 'Remove fixture pages', exact: true }));
      }
      assert(await bookmark.isDisabled(), 'Empty reading cannot be bookmarked');
      const contents = page.getByRole('button', { name: 'Contents', exact: true });
      if (await contents.isVisible() && await contents.getAttribute('aria-expanded') === 'false') await activate(page, contents);
      await activate(page, page.getByRole('button', { name: /^Bookmarks/ }));
      assert.equal(await page.getByRole('navigation', { name: 'Bookmarks', exact: true }).textContent(), '');
      assert(await page.getByRole('heading', { name: 'Reading content unavailable' }).isVisible());
    }
    for (const scene of ['reflection', 'mastery']) {
      await go(`mode=native&scene=${scene}&late`);
      await page.locator('[data-shell-ready=true]').waitFor({ state: 'attached' });
      assert.equal(await page.getByRole('button', { name: 'Ask the AI tutor about this lesson', exact: true }).count(), 0);
      assert.equal(await page.locator('[data-assistant-presentation]').count(), 0, 'Late tutor shell stays withheld');
      assert(await page.locator('button[data-primary]').last().isDisabled(), 'Independent response remains required');
    }
    await go('mode=native&scene=explain');
    const ask = page.getByRole('button', { name: 'Ask the AI tutor about this lesson', exact: true });
    await activate(page, ask);
    await page.getByRole('button', { name: 'Explain this topic', exact: true }).waitFor();
    const marker = JSON.parse(await page.locator('[data-native-tutor-context]').getAttribute('data-native-tutor-context'));
    assert.equal(marker.identity.sceneId, 'explain'); assert.equal(marker.identity.contentId, 'review-native');
    assert.equal(marker.blocked, false);
    // Do not invoke a paid model or generate an answer. Server refusal is covered by route/context tests.
    await page.screenshot({ path: `${out}/formative-help-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []); assert.deepEqual(posts, []);
    results.push({ width, authoredHeading: true, emptyBookmarkDisabled: true, changedContentSafe: true, protectedHelpWithheld: true, lateMountSafe: true, formativeIdentity: marker.identity, errors, posts });
    await context.close();
  }
  fs.writeFileSync(`${out}/browser-repairs.json`, JSON.stringify({ scope: 'Synthetic component runtime; no authenticated production delivery or model generation.', results }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); await server.close(); }
