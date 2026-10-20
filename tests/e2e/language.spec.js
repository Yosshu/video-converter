// Japanese / English: choosing by URL, by browser language, by the switch,
// and keeping everything on screen in step when switching.

import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** Japanese words visible on the page, apart from the "日本語" switch button. */
async function visibleJapanese(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.replace('日本語', '');
    return text.match(/[぀-ヿ一-鿿]+/g) ?? [];
  });
}

async function waitUntilReady(page, label) {
  await expect(page.locator('#convert')).toHaveText(label);
  await expect(page.locator('#convert')).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('?lang=en shows the whole tool in English', async ({ page }) => {
  await page.goto('./?lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Video Converter');
  await expect(page.locator('h1')).toHaveText('Video Converter');
  await expect(page.locator('[data-set-lang="en"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#convert')).toHaveText('Start converting');
  await page.locator('.advanced summary').click();
  expect(await visibleJapanese(page)).toEqual([]);

  // Errors are explained in English too.
  await page.locator('#file-input').setInputFiles(fixture('not-a-video.txt'));
  await expect(page.locator('#select-message')).toContainText('This does not look like a video');
  await expect(page.locator('#select-message')).toContainText('Cause:');
  await expect(page.locator('#select-message')).toContainText('What to do');

  await page.locator('#file-input').setInputFiles(fixture('hevc-screen.mp4'));
  await expect(page.locator('#info-video')).toContainText('HEVC (H.265)');
  await expect(page.locator('#info-video')).toContainText('Will be converted to H.264');
  await expect(page.locator('#info-duration')).toHaveText('3 s');
  await waitUntilReady(page, 'Start converting');
  await expect(page.locator('#plan')).toContainText('Video: HEVC (H.265) → H.264');
  await page.locator('#convert').click();
  await expect(page.locator('#status-label')).toHaveText('Conversion complete', { timeout: 180_000 });
  await expect(page.locator('#progress-time')).toHaveText(/^Took \d+:\d\d$/);
  await expect(page.locator('#out-video')).toHaveText('H.264 (AVC) · yuv420p');
  await expect(page.locator('#download')).toHaveText('Download');
  expect(await visibleJapanese(page)).toEqual([]);
});

test('without ?lang, the browser language decides', async ({ browser }) => {
  for (const [locale, expected] of [
    ['en-US', 'Video Converter'],
    ['fr-FR', 'Video Converter'],
    ['ja-JP', '動画変換ツール'],
  ]) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.locator('h1')).toHaveText(expected);
    await context.close();
  }
});

test('the switch translates what is on screen, and is remembered', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toHaveText('動画変換ツール');
  await page.locator('#file-input').setInputFiles(fixture('h264-aac.mov'));
  await waitUntilReady(page, '変換開始');
  await page.locator('#convert').click();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'done');

  await page.locator('[data-set-lang="en"]').click();
  await expect(page).toHaveURL(/\?lang=en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText('Video Converter');
  await expect(page.locator('#info-video')).toContainText('Ready to use');
  await expect(page.locator('#plan')).toContainText('Video: repackaged as MP4');
  await expect(page.locator('#status-label')).toHaveText('Conversion complete');
  await expect(page.locator('#progress-time')).toHaveText(/^Took /);
  await expect(page.locator('#out-audio')).toHaveText('AAC');
  await expect(page.locator('#convert')).toHaveText('Start converting');
  expect(await visibleJapanese(page)).toEqual([]);

  // And back.
  await page.locator('[data-set-lang="ja"]').click();
  await expect(page.locator('h1')).toHaveText('動画変換ツール');
  await expect(page.locator('#info-video')).toContainText('そのまま使えます');
  await expect(page.locator('.lead')).toHaveText('iPhoneの画面録画を、Windows・Ubuntu・Macで再生できるH.264形式のMP4に変換します');

  // The last choice is used when the URL does not say…
  await page.locator('[data-set-lang="en"]').click();
  await page.goto('./');
  await expect(page.locator('h1')).toHaveText('Video Converter');
  // …but the URL wins.
  await page.goto('./?lang=ja');
  await expect(page.locator('h1')).toHaveText('動画変換ツール');
});

test('switching while converting keeps the progress readable', async ({ page }) => {
  await page.goto('./?lang=ja');
  await page.locator('#file-input').setInputFiles(fixture('hevc-long.mp4'));
  await waitUntilReady(page, '変換開始');
  await page.locator('#convert').click();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'converting');
  await page.locator('[data-set-lang="en"]').click();
  await expect(page.locator('#status-label')).toHaveText('Converting to H.264…');
  await expect(page.locator('#status-detail')).toHaveText('Keep this page open until the conversion finishes.');
  await expect(page.locator('#progress-time')).toHaveText(/^Elapsed /);
  await expect(page.locator('#convert')).toHaveText('Converting…');
  await page.locator('#cancel').click();
  await expect(page.locator('#status-label')).toHaveText('Conversion cancelled');
  await expect(page.locator('#run-message')).toContainText('Press "Start converting" to convert again');
});

test('the licenses page follows the language', async ({ page }) => {
  await page.goto('./?lang=en');
  await page.getByRole('link', { name: 'Licenses and source code' }).click();
  await expect(page).toHaveURL(/licenses\.html\?lang=en$/);
  await expect(page.locator('h1')).toHaveText('Licenses and source code');
  await expect(page).toHaveTitle('Licenses - Video Converter');
  expect(await visibleJapanese(page)).toEqual([]);
  await page.locator('[data-set-lang="ja"]').click();
  await expect(page.locator('h1')).toHaveText('ライセンスとソースコード');
  await page.getByRole('link', { name: '← 動画変換ツールに戻る' }).click();
  await expect(page).toHaveURL(/video-converter\/\?lang=ja$/);
  await expect(page.locator('h1')).toHaveText('動画変換ツール');
});
