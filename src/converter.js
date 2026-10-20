// Runs FFmpeg (ffmpeg.wasm) in a Web Worker so the page stays responsive.
//
// - The input File is mounted with WORKERFS: ffmpeg reads it piece by piece
//   in the worker instead of the whole video being copied into memory.
// - Every URL is relative to this module, so it works under any sub-path.
// - Cancelling terminates the worker; after a conversion the worker is
//   terminated as well, which is the only way to hand WebAssembly memory back.

import { FFmpeg } from '../vendor/ffmpeg/index.js';
import { AppError, classifyFailure } from './errors.js';
import { buildArgs } from './ffmpeg-args.js';
import { parseProbe } from './media-info.js';

const CORE_URL = new URL('../vendor/ffmpeg-core/ffmpeg-core.js', import.meta.url).href;
const WASM_URL = new URL('../vendor/ffmpeg-core/ffmpeg-core.wasm', import.meta.url).href;

const LOAD_TIMEOUT_MS = 120_000;
const PROBE_TIMEOUT_MS = 60_000;
const LOG_LIMIT = 400;
const OUTPUT_PATH = '/output.mp4';
const PROBE_PATH = '/probe.json';

/** Whether this browser has what ffmpeg.wasm needs (WebAssembly and module workers). */
export function browserSupported() {
  if (typeof WebAssembly !== 'object' || typeof Worker !== 'function') return false;
  let moduleWorkers = false;
  let url;
  try {
    url = URL.createObjectURL(new Blob([''], { type: 'text/javascript' }));
    const options = {
      get type() {
        moduleWorkers = true;
        return 'module';
      },
    };
    new Worker(url, options).terminate();
  } catch {
    moduleWorkers = false;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
  return moduleWorkers;
}

/** Downloads a file as a Blob, reporting progress. */
async function fetchWithProgress(url, type, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  let total = Number(response.headers.get('Content-Length')) || 0;
  if (!response.body) return new Blob([await response.arrayBuffer()], { type });
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    // A compressed response reports its compressed length; the total is then unknown.
    if (total && loaded > total) total = 0;
    onProgress?.({ loaded, total });
  }
  return new Blob(chunks, { type });
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function safeExtension(name) {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name ?? '')?.[1];
  return ext ? ext.toLowerCase() : 'mp4';
}

const TIME_IN_LOG = /time=(-?)(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/;

export class Converter {
  /** @type {FFmpeg | null} */
  #ffmpeg = null;
  /** @type {Promise<FFmpeg> | null} */
  #loading = null;
  /** @type {FFmpeg | null} the instance being loaded, so that it can be cancelled */
  #pending = null;
  /**
   * The downloaded ffmpeg-core.wasm, kept for the life of the page. The worker
   * is shut down after every conversion; reloading it from this Blob avoids
   * downloading 31 MB again where the HTTP cache does not keep it (private
   * windows keep only a small cache in memory).
   * @type {string | null}
   */
  #wasmBlobURL = null;
  #canceled = false;
  #queue = Promise.resolve();
  #mounts = 0;
  #logs = [];
  /** @type {((timeUs: number) => void) | null} */
  #onTime = null;

  /** The most recent ffmpeg log lines, for troubleshooting. */
  get log() {
    return this.#logs.join('\n');
  }

  get loaded() {
    return this.#ffmpeg !== null;
  }

  /** Whether the FFmpeg download has already been done in this page. */
  get downloaded() {
    return this.#wasmBlobURL !== null;
  }

  /**
   * Loads ffmpeg.wasm (a 31 MB download the first time in a page).
   * Calling it again while loading, or after loading, is cheap.
   *
   * @param {{ onProgress?: (p: { loaded: number, total: number }) => void }} [options]
   */
  load({ onProgress } = {}) {
    if (this.#ffmpeg) return Promise.resolve(this.#ffmpeg);
    this.#loading ??= this.#load(onProgress).finally(() => {
      this.#loading = null;
    });
    return this.#loading;
  }

  async #load(onProgress) {
    this.#canceled = false;
    try {
      if (!this.#wasmBlobURL) {
        const wasm = await fetchWithProgress(WASM_URL, 'application/wasm', onProgress);
        this.#wasmBlobURL = URL.createObjectURL(wasm);
      }
    } catch (error) {
      throw new AppError('LOAD_FAILED', { cause: error });
    }
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => this.#addLog(message));
    ffmpeg.on('progress', ({ time }) => this.#onTime?.(time));
    this.#pending = ffmpeg;
    try {
      await withTimeout(ffmpeg.load({ coreURL: CORE_URL, wasmURL: this.#wasmBlobURL }), LOAD_TIMEOUT_MS);
    } catch (error) {
      ffmpeg.terminate();
      if (this.#canceled) throw new AppError('CANCELED');
      throw new AppError('LOAD_FAILED', { cause: error });
    } finally {
      this.#pending = null;
    }
    this.#ffmpeg = ffmpeg;
    return ffmpeg;
  }

  #addLog(message) {
    // ffmpeg.wasm ends every run with abort(); it is not an error.
    if (message === 'Aborted()') return;
    this.#logs.push(message);
    if (this.#logs.length > LOG_LIMIT) this.#logs.splice(0, this.#logs.length - LOG_LIMIT);
    // Progress normally arrives as an event; the stats line is a fallback.
    const match = this.#onTime && TIME_IN_LOG.exec(message);
    if (match && !match[1]) {
      const seconds = Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]);
      this.#onTime(seconds * 1e6);
    }
  }

  /** Runs tasks one at a time: ffmpeg.wasm can only do one thing at once. */
  #exclusive(task) {
    const run = this.#queue.then(task);
    this.#queue = run.catch(() => {});
    return run;
  }

  async #mountInput(ffmpeg, file) {
    this.#mounts += 1;
    const dir = `/input${this.#mounts}`;
    // An ASCII name: ffmpeg would read "name:with:colons" as a protocol.
    const name = `input.${safeExtension(file.name)}`;
    await ffmpeg.createDir(dir);
    const mounted = await ffmpeg.mount('WORKERFS', { blobs: [{ name, data: file }] }, dir);
    if (!mounted) throw new Error('WORKERFS is not available');
    return { dir, path: `${dir}/${name}` };
  }

  async #unmountInput(ffmpeg, dir) {
    if (ffmpeg !== this.#ffmpeg) return; // terminated meanwhile
    await ffmpeg.unmount(dir).catch(() => {});
    await ffmpeg.deleteDir(dir).catch(() => {});
  }

  /** ffprobe's findings about a file inside the worker, or null if it could not read it. */
  async #probePath(ffmpeg, path) {
    // ffprobe in ffmpeg.wasm does not report an exit code, so success is
    // judged by whether it wrote usable JSON.
    await ffmpeg.ffprobe(
      ['-loglevel', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-o', PROBE_PATH, path],
      PROBE_TIMEOUT_MS,
    );
    let text;
    try {
      text = await ffmpeg.readFile(PROBE_PATH, 'utf8');
      await ffmpeg.deleteFile(PROBE_PATH);
    } catch {
      return null;
    }
    try {
      const json = JSON.parse(text);
      return Array.isArray(json.streams) && json.streams.length > 0 ? parseProbe(json) : null;
    } catch {
      return null;
    }
  }

  /**
   * Reads the video's format, length, size and streams.
   *
   * @param {File} file
   * @returns {Promise<ReturnType<typeof parseProbe>>}
   */
  probe(file) {
    return this.#exclusive(async () => {
      const ffmpeg = await this.load();
      this.#logs = [];
      const { dir, path } = await this.#mountInput(ffmpeg, file);
      try {
        const info = await this.#probePath(ffmpeg, path);
        if (!info) {
          const failure = classifyFailure(this.#logs);
          throw failure.code === 'CONVERT_FAILED' ? new AppError('UNREADABLE') : failure;
        }
        if (!info.video) throw new AppError('NO_VIDEO_STREAM');
        return info;
      } finally {
        await this.#unmountInput(ffmpeg, dir);
      }
    });
  }

  /**
   * Converts the file to MP4 as planned. Afterwards the worker is shut down
   * to release its memory; the next call loads it again (from the cache).
   *
   * @param {File} file
   * @param {ReturnType<typeof parseProbe>} info
   * @param {ReturnType<typeof import('./ffmpeg-args.js').planConversion>} plan
   * @param {{ onProgress?: (ratio: number) => void }} [options]
   * @returns {Promise<{ data: Uint8Array, info: ReturnType<typeof parseProbe> | null }>}
   */
  convert(file, info, plan, { onProgress } = {}) {
    this.#canceled = false;
    return this.#exclusive(async () => {
      let ffmpeg;
      let dir;
      try {
        ffmpeg = await this.load();
        if (this.#canceled) throw new AppError('CANCELED');
        this.#logs = [];
        const input = await this.#mountInput(ffmpeg, file);
        dir = input.dir;
        const durationUs = (info.durationSec ?? 0) * 1e6;
        let best = 0;
        this.#onTime = (timeUs) => {
          if (!durationUs || !(timeUs > 0)) return;
          const ratio = Math.min(timeUs / durationUs, 1);
          if (ratio > best) {
            best = ratio;
            onProgress?.(ratio);
          }
        };
        const args = buildArgs({ input: input.path, output: OUTPUT_PATH, info, plan });
        let ret;
        try {
          ret = await ffmpeg.exec(args);
        } catch (error) {
          if (this.#canceled) throw new AppError('CANCELED');
          throw classifyFailure(this.#logs, { error, info });
        } finally {
          this.#onTime = null;
        }
        if (this.#canceled) throw new AppError('CANCELED');
        if (ret !== 0) throw classifyFailure(this.#logs, { info });

        // Check what was actually written, so the page can show it.
        const outputInfo = await this.#probePath(ffmpeg, OUTPUT_PATH);
        const data = await ffmpeg.readFile(OUTPUT_PATH);
        if (!(data instanceof Uint8Array) || data.byteLength === 0) {
          throw classifyFailure(this.#logs, { info });
        }
        onProgress?.(1);
        return { data, info: outputInfo };
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (this.#canceled) throw new AppError('CANCELED');
        throw classifyFailure(this.#logs, { error, info });
      } finally {
        if (ffmpeg && ffmpeg === this.#ffmpeg) {
          await ffmpeg.deleteFile(OUTPUT_PATH).catch(() => {});
          if (dir) await this.#unmountInput(ffmpeg, dir);
        }
        this.dispose();
      }
    });
  }

  /** Stops whatever is running (loading or converting). */
  cancel() {
    this.#canceled = true;
    this.#pending?.terminate();
    this.dispose();
  }

  /** Shuts the worker down, releasing all of its memory. */
  dispose() {
    this.#ffmpeg?.terminate();
    this.#ffmpeg = null;
  }
}
