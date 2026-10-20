// End-to-end tests against the built site (dist/), served under
// /video-converter/ the way GitHub Pages serves a project site.
// Converted files are checked with the native ffprobe.

import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** Decodes the whole file with the native ffmpeg; throws if it is not playable. */
function decodesCleanly(path) {
  const result = execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', path, '-f', 'null', '-'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.toString() === '';
}

function ffprobe(path) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path]);
  const json = JSON.parse(out.toString());
  return {
    video: json.streams.filter((s) => s.codec_type === 'video'),
    audio: json.streams.filter((s) => s.codec_type === 'audio'),
    format: json.format,
  };
}

async function selectFile(page, name) {
  await page.locator('#file-input').setInputFiles(fixture(name));
}

async function waitUntilReady(page) {
  await expect(page.locator('#convert')).toHaveText('変換開始');
  await expect(page.locator('#convert')).toBeEnabled();
}

async function convertAndDownload(page, testInfo) {
  await page.locator('#convert').click();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'done', { timeout: 180_000 });
  await expect(page.locator('#status-label')).toHaveText('変換が完了しました');
  await expect(page.locator('#progress')).toHaveAttribute('value', '100');
  await expect(page.locator('#result-section')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloadPromise;
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  return { name: download.suggestedFilename(), path };
}

test.beforeEach(async ({ page }, testInfo) => {
  page.on('dialog', (dialog) => dialog.accept());
  // Every request must stay on this site.
  const origin = new URL(testInfo.project.use.baseURL).origin;
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      expect(url.startsWith(`${origin}/video-converter/`), `unexpected request: ${url}`).toBe(true);
    }
  });
  page.on('response', (response) => {
    expect(response.status(), `failed: ${response.url()}`).toBeLessThan(400);
  });
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.goto('./');
});

test('the page loads under a sub-path and explains itself', async ({ page }) => {
  await expect(page).toHaveTitle('動画変換ツール');
  await expect(page.locator('h1')).toHaveText('動画変換ツール');
  await expect(page.locator('.lead')).toHaveText('iPhoneの画面録画を、互換性の高いH.264形式のMP4に変換します');
  await expect(page.locator('.hints')).toContainText('2GB まで');
  await expect(page.locator('#privacy-title')).toBeVisible();
  await expect(page.locator('.footer')).toContainText('@ffmpeg/ffmpeg 0.12.15');
  await expect(page.locator('.footer')).toContainText('@ffmpeg/core 0.12.10');
  await expect(page.locator('#file-section')).toBeHidden();
  await expect(page.locator('#unsupported')).toBeHidden();
  await page.locator('a[href="licenses.html"]').click();
  await expect(page.locator('h1')).toHaveText('ライセンスとソースコード');
  await expect(page.locator('body')).toContainText('@ffmpeg/core 0.12.10');
  for (const href of ['licenses/GPL-2.0.txt', 'licenses/ffmpeg.wasm-MIT.txt']) {
    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
  }
});

test('converts an HEVC screen recording to H.264 + AAC MP4', async ({ page }, testInfo) => {
  await selectFile(page, 'hevc-screen.mp4');
  await expect(page.locator('#info-name')).toHaveText('hevc-screen.mp4');
  await expect(page.locator('#info-video')).toContainText('HEVC（H.265）');
  await expect(page.locator('#info-video')).toContainText('H.264 に変換します');
  await expect(page.locator('#info-resolution')).toHaveText('590 × 1278');
  await expect(page.locator('#info-duration')).toHaveText('3秒');
  await expect(page.locator('#info-audio')).toHaveText('AAC');
  await expect(page.locator('#h264-mode')).toBeHidden();
  await waitUntilReady(page);
  await expect(page.locator('#plan')).toContainText('HEVC（H.265） → H.264 に変換');

  const { name, path } = await convertAndDownload(page, testInfo);
  expect(name).toBe('hevc-screen_H264.mp4');
  await expect(page.locator('#out-video')).toHaveText('H.264（AVC）・yuv420p');
  await expect(page.locator('#out-audio')).toHaveText('AAC');
  await expect(page.locator('#out-resolution')).toHaveText('590 × 1278');
  await expect(page.locator('#size-before')).toHaveText(/KB$/);
  await expect(page.locator('#preview')).toHaveAttribute('src', /^blob:/);

  const out = ffprobe(path);
  expect(out.format.format_name).toContain('mp4');
  expect(out.video).toHaveLength(1);
  expect(out.video[0].codec_name).toBe('h264');
  expect(out.video[0].pix_fmt).toBe('yuv420p');
  expect([out.video[0].width, out.video[0].height]).toEqual([590, 1278]);
  expect(out.audio).toHaveLength(1);
  expect(out.audio[0].codec_name).toBe('aac');
  expect(Number(out.format.duration)).toBeCloseTo(2.93, 0);
  // The original frame timing is kept (variable frame rate, no padding frames).
  expect(Number(out.video[0].nb_frames)).toBe(88);
  expect(decodesCleanly(path)).toBe(true);
});

test('converts HEVC without audio and applies its rotation', async ({ page }, testInfo) => {
  await selectFile(page, 'hevc-noaudio.mov');
  await expect(page.locator('#info-audio')).toHaveText('なし');
  await expect(page.locator('#info-resolution')).toHaveText('270 × 480');
  await waitUntilReady(page);
  const { name, path } = await convertAndDownload(page, testInfo);
  expect(name).toBe('hevc-noaudio_H264.mp4');
  await expect(page.locator('#out-audio')).toHaveText('なし');
  const out = ffprobe(path);
  expect(out.video[0].codec_name).toBe('h264');
  expect([out.video[0].width, out.video[0].height]).toEqual([270, 480]);
  expect(out.audio).toHaveLength(0);
  expect(decodesCleanly(path)).toBe(true);
});

test('repackages video that is already H.264 without re-encoding', async ({ page }, testInfo) => {
  await selectFile(page, 'h264-aac.mov');
  await expect(page.locator('#info-video')).toContainText('そのまま使えます');
  await expect(page.locator('#h264-mode')).toBeVisible();
  await waitUntilReady(page);
  await expect(page.locator('#plan')).toContainText('作り直さずに');
  // The picture settings do not apply when the video is copied.
  await expect(page.locator('#quality-group')).toHaveAttribute('disabled', '');
  await expect(page.locator('input[name="quality"]').first()).toBeDisabled();
  const { path } = await convertAndDownload(page, testInfo);
  const out = ffprobe(path);
  const source = ffprobe(fixture('h264-aac.mov'));
  expect(out.video[0].codec_name).toBe('h264');
  expect(out.audio[0].codec_name).toBe('aac');
  expect(out.format.format_name).toContain('mp4');
  // Copied, not re-encoded: same number of frames and same bit rate.
  expect(out.video[0].nb_frames).toBe(source.video[0].nb_frames);
  expect(out.video[0].bit_rate).toBe(source.video[0].bit_rate);
  expect(decodesCleanly(path)).toBe(true);
});

test('re-encodes H.264 when asked to, with the chosen settings', async ({ page }, testInfo) => {
  await selectFile(page, 'h264-aac.mov');
  await waitUntilReady(page);
  await page.locator('input[name="h264Mode"][value="encode"]').check();
  await expect(page.locator('input[name="quality"]').first()).toBeEnabled();
  await page.locator('input[name="quality"][value="small"]').check();
  await page.locator('.advanced summary').click();
  await page.locator('input[name="audio"][value="remove"]').check();
  await expect(page.locator('#plan')).toContainText('音声：消す');
  const { path } = await convertAndDownload(page, testInfo);
  const out = ffprobe(path);
  const source = ffprobe(fixture('h264-aac.mov'));
  expect(out.video[0].codec_name).toBe('h264');
  expect(out.video[0].bit_rate).not.toBe(source.video[0].bit_rate);
  expect(out.audio).toHaveLength(0);
});

test('makes odd-sized 4:4:4 H.264 playable (yuv420p, even size)', async ({ page }, testInfo) => {
  await selectFile(page, 'h264-yuv444-odd.mp4');
  await expect(page.locator('#info-video')).toContainText('H.264 に変換します');
  await expect(page.locator('#info-note')).toContainText('4:4:4');
  await waitUntilReady(page);
  const { path } = await convertAndDownload(page, testInfo);
  const out = ffprobe(path);
  expect(out.video[0].pix_fmt).toBe('yuv420p');
  expect([out.video[0].width, out.video[0].height]).toEqual([300, 160]);
  expect(decodesCleanly(path)).toBe(true);
});

test('can be cancelled, then converts again', async ({ page }, testInfo) => {
  let wasmDownloads = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/ffmpeg-core.wasm')) wasmDownloads += 1;
  });
  await selectFile(page, 'hevc-long.mp4');
  await waitUntilReady(page);
  await page.locator('#convert').click();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'converting');
  await expect(page.locator('#convert')).toBeDisabled();
  await expect(page.locator('#change-file')).toBeDisabled();
  // Wait for real progress before cancelling.
  await expect(page.locator('#progress-percent')).toHaveText(/^([1-9]\d?)%$/, { timeout: 120_000 });
  // The page stays responsive while converting: timers on the main thread run on time.
  const longestGapMs = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let last = performance.now();
        let longest = 0;
        const end = last + 2000;
        const tick = () => {
          const now = performance.now();
          longest = Math.max(longest, now - last);
          last = now;
          if (now < end) setTimeout(tick, 10);
          else resolve(longest);
        };
        setTimeout(tick, 10);
      }),
  );
  expect(longestGapMs).toBeLessThan(200);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'converting');
  await page.locator('#cancel').click();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'canceled');
  await expect(page.locator('#run-message [data-code="CANCELED"]')).toBeVisible();
  await expect(page.locator('#result-section')).toBeHidden();
  await expect(page.locator('#cancel')).toBeHidden();
  await expect(page.locator('#change-file')).toBeEnabled();

  // The page is usable again: pick a short video and convert it.
  await selectFile(page, 'hevc-screen.mp4');
  await waitUntilReady(page);
  const { path } = await convertAndDownload(page, testInfo);
  expect(ffprobe(path).video[0].codec_name).toBe('h264');
  // FFmpeg was loaded three times (probe, cancelled run, second run) but downloaded once.
  expect(wasmDownloads).toBe(1);
});

test('explains files it cannot use', async ({ page }) => {
  await page.locator('#convert').click();
  await expect(page.locator('#run-message [data-code="NO_FILE"]')).toContainText('動画が選択されていません');

  await selectFile(page, 'not-a-video.txt');
  await expect(page.locator('#select-message [data-code="NOT_VIDEO"]')).toContainText('動画ファイルではないようです');
  await expect(page.locator('#file-section')).toBeHidden();

  await selectFile(page, 'broken.mp4');
  await expect(page.locator('#select-message [data-code="UNREADABLE"]')).toContainText('この動画を読み込めませんでした');
  await expect(page.locator('#select-message')).toContainText('原因：');
  await expect(page.locator('#select-message')).toContainText('対処方法');
  await page.locator('#convert').click();
  await expect(page.locator('#run-message [data-code="UNREADABLE"]')).toBeVisible();

  await selectFile(page, 'audio-only.mp4');
  await expect(page.locator('#select-message [data-code="NO_VIDEO_STREAM"]')).toContainText('映像が見つかりませんでした');

  // A good file afterwards works.
  await selectFile(page, 'hevc-noaudio.mov');
  await waitUntilReady(page);
  await expect(page.locator('#select-message')).toBeEmpty();
});

test('a selection can be cleared and changed before converting', async ({ page }) => {
  await selectFile(page, 'hevc-screen.mp4');
  await waitUntilReady(page);
  await page.locator('#clear-file').click();
  await expect(page.locator('#file-section')).toBeHidden();
  await page.locator('#convert').click();
  await expect(page.locator('#run-message [data-code="NO_FILE"]')).toBeVisible();

  await selectFile(page, 'hevc-screen.mp4');
  await waitUntilReady(page);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#change-file').click();
  await (await chooser).setFiles(fixture('h264-aac.mov'));
  await expect(page.locator('#info-name')).toHaveText('h264-aac.mov');
  await waitUntilReady(page);
});

test('accepts a dropped file', async ({ page }) => {
  const bytes = [...readFileSync(fixture('hevc-noaudio.mov'))];
  const dataTransfer = await page.evaluateHandle((data) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data)], 'dropped.mov', { type: 'video/quicktime' }));
    return transfer;
  }, bytes);
  await page.locator('#dropzone').dispatchEvent('dragenter', { dataTransfer });
  await expect(page.locator('#dropzone')).toHaveClass(/is-dragging/);
  await page.locator('#dropzone').dispatchEvent('drop', { dataTransfer });
  await expect(page.locator('#info-name')).toHaveText('dropped.mov');
  await waitUntilReady(page);
  await expect(page.locator('#dropzone')).not.toHaveClass(/is-dragging/);
});

test('reports a failed FFmpeg download and recovers on retry', async ({ page }) => {
  await page.route('**/ffmpeg-core.wasm', (route) => route.abort('internetdisconnected'));
  await selectFile(page, 'hevc-noaudio.mov');
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'error');
  const message = page.locator('#run-message [data-code="LOAD_FAILED"]');
  await expect(message).toContainText('FFmpeg）を読み込めませんでした');
  await page.unroute('**/ffmpeg-core.wasm');
  await message.getByRole('button', { name: 'もう一度試す' }).click();
  await waitUntilReady(page);
  await expect(page.locator('#info-video')).toContainText('HEVC');
  await expect(page.locator('#run-message')).toBeEmpty();
});

test('the layout fits a phone screen @mobile', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await selectFile(page, 'hevc-noaudio.mov');
  await waitUntilReady(page);
  await page.locator('.advanced summary').click();
  const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflowAfter).toBeLessThanOrEqual(0);
  await page.screenshot({ path: test.info().outputPath('mobile.png'), fullPage: true });
});
