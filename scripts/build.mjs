// Builds the static site into dist/.
//
// There is no bundler: the app's own files are copied as they are, and the
// FFmpeg.wasm files are copied from node_modules into dist/vendor/ so that
// they are served from the same origin as the page (no CDN). Every URL in the
// app is relative, so the site works under any sub-path such as
// https://<user>.github.io/<repo>/.

import { createHash } from 'node:crypto';
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
//
// Browsers may keep a file from GitHub Pages for up to 10 minutes, so right
// after a release a new page could run with an old script or style sheet.
// Every reference to the app's own files therefore carries "?v=<build id>",
// a hash of their contents: a new release can only load files of its own.
const pages = ['index.html', 'licenses.html'];
const srcFiles = (await readdir(join(root, 'src'))).sort();
const hash = createHash('sha256');
for (const file of srcFiles) hash.update(file).update(await readFile(join(root, 'src', file)));
for (const page of pages) hash.update(page).update(await readFile(join(root, page)));
hash.update(JSON.stringify(versions));
const buildId = hash.digest('hex').slice(0, 10);

// import … from './x.js', import('./x.js'), and the vendor import.
const versionImports = (code) =>
  code.replace(/((?:from|import)\s*\(?\s*)(['"])(\.\.?\/[^'"]+\.js)\2/g, `$1$2$3?v=${buildId}$2`);
// <script src="src/…"> and <link href="src/…">.
const versionPageRefs = (html) => html.replace(/((?:src|href)=")(src\/[^"?]+\.(?:js|css))"/g, `$1$2?v=${buildId}"`);

await mkdir(join(dist, 'src'), { recursive: true });
for (const file of srcFiles) {
  let content = await readFile(join(root, 'src', file), 'utf8');
  if (file.endsWith('.js')) content = versionImports(content);
  await writeFile(join(dist, 'src', file), content);
}
await cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
await cp(join(root, 'LICENSES'), join(dist, 'licenses'), { recursive: true });
for (const page of pages) {
  let html = await readFile(join(root, page), 'utf8');
  for (const [placeholder, value] of Object.entries(versions)) {
    html = html.replaceAll(placeholder, value);
  }
  if (/__[A-Z_]+_VERSION__/.test(html)) throw new Error(`${page}: unreplaced placeholder`);
  await writeFile(join(dist, page), versionPageRefs(html));
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
  `Built dist/ (build ${buildId}, @ffmpeg/ffmpeg ${versions.__FFMPEG_VERSION__}, @ffmpeg/core ${versions.__CORE_VERSION__})`,
);
