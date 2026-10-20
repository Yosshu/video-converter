// Builds the static site into dist/.
//
// There is no bundler: the app's own files are copied as they are, and the
// FFmpeg.wasm files are copied from node_modules into dist/vendor/ so that
// they are served from the same origin as the page (no CDN). Every URL in the
// app is relative, so the site works under any sub-path such as
// https://<user>.github.io/<repo>/.

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// The packages restrict what can be resolved through "exports", so their
// files are read straight from node_modules.
const pkgDir = (name) => join(root, 'node_modules', ...name.split('/'));
const pkgVersion = async (name) =>
  JSON.parse(await readFile(join(pkgDir(name), 'package.json'), 'utf8')).version;

const versions = {
  __FFMPEG_VERSION__: await pkgVersion('@ffmpeg/ffmpeg'),
  __CORE_VERSION__: await pkgVersion('@ffmpeg/core'),
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// The app itself.
await cp(join(root, 'src'), join(dist, 'src'), { recursive: true });
await cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
await cp(join(root, 'LICENSES'), join(dist, 'licenses'), { recursive: true });
for (const page of ['index.html', 'licenses.html']) {
  let html = await readFile(join(root, page), 'utf8');
  for (const [placeholder, value] of Object.entries(versions)) {
    html = html.replaceAll(placeholder, value);
  }
  if (/__[A-Z_]+_VERSION__/.test(html)) throw new Error(`${page}: unreplaced placeholder`);
  await writeFile(join(dist, page), html);
}

// FFmpeg.wasm: the worker-based wrapper (ES modules) and the single-thread core.
// The single-thread core is used on purpose: it does not need SharedArrayBuffer,
// so it works without the COOP/COEP headers that GitHub Pages cannot send.
const ffmpegSrc = join(pkgDir('@ffmpeg/ffmpeg'), 'dist', 'esm');
const ffmpegDest = join(dist, 'vendor', 'ffmpeg');
await mkdir(ffmpegDest, { recursive: true });
for (const file of await readdir(ffmpegSrc)) {
  if (file.endsWith('.js')) await cp(join(ffmpegSrc, file), join(ffmpegDest, file));
}
const coreSrc = join(pkgDir('@ffmpeg/core'), 'dist', 'esm');
const coreDest = join(dist, 'vendor', 'ffmpeg-core');
await mkdir(coreDest, { recursive: true });
for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  await cp(join(coreSrc, file), join(coreDest, file));
}

// Served through GitHub Actions there is no Jekyll step, but this keeps a
// branch-based Pages setup from skipping any file either.
await writeFile(join(dist, '.nojekyll'), '');

console.log(
  `Built dist/ (@ffmpeg/ffmpeg ${versions.__FFMPEG_VERSION__}, @ffmpeg/core ${versions.__CORE_VERSION__})`,
);
