// The page: choosing a file, settings, progress and the result.
// All video work happens in converter.js (inside a Web Worker).

import { Converter, browserSupported } from './converter.js';
import { AppError, describeError } from './errors.js';
import { DEFAULT_SETTINGS, planConversion } from './ffmpeg-args.js';
import { initI18n, lang, onLanguageChange, t } from './i18n.js';
import { codecLabel } from './media-info.js';
import {
  fileExtension,
  formatBytes,
  formatClock,
  formatDuration,
  formatResolution,
  formatSizeChange,
  outputFileName,
} from './format.js';

const MAX_FILE_SIZE = 2 * 1024 ** 3;
const MAX_FILE_SIZE_LABEL = '2GB';
// Extensions accepted even when the browser does not report a video MIME type.
const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'm4v', '3gp', '3g2', 'mkv', 'webm', 'avi', 'mts', 'm2ts', 'ts', 'mpg', 'mpeg', 'wmv', 'flv', 'hevc',
]);

const $ = (id) => document.getElementById(id);
const el = {
  unsupported: $('unsupported'),
  dropzone: $('dropzone'),
  pick: $('pick'),
  fileInput: $('file-input'),
  selectMessage: $('select-message'),
  fileSection: $('file-section'),
  infoName: $('info-name'),
  infoSize: $('info-size'),
  infoDuration: $('info-duration'),
  infoResolution: $('info-resolution'),
  infoVideo: $('info-video'),
  infoAudio: $('info-audio'),
  infoNote: $('info-note'),
  changeFile: $('change-file'),
  clearFile: $('clear-file'),
  settings: $('settings'),
  h264Mode: $('h264-mode'),
  videoGroups: ['quality-group', 'speed-group', 'size-group', 'fps-group'].map($),
  audioGroup: $('audio-group'),
  plan: $('plan'),
  convert: $('convert'),
  statusPanel: $('status-panel'),
  status: $('status'),
  statusLabel: $('status-label'),
  statusDetail: $('status-detail'),
  progressArea: $('progress-area'),
  progress: $('progress'),
  progressPercent: $('progress-percent'),
  progressTime: $('progress-time'),
  cancel: $('cancel'),
  runMessage: $('run-message'),
  resultSection: $('result-section'),
  resultTitle: $('result-title'),
  preview: $('preview'),
  previewNote: $('preview-note'),
  sizeBefore: $('size-before'),
  sizeAfter: $('size-after'),
  sizeChange: $('size-change'),
  outName: $('out-name'),
  outVideo: $('out-video'),
  outAudio: $('out-audio'),
  outResolution: $('out-resolution'),
  outDuration: $('out-duration'),
  download: $('download'),
  share: $('share'),
  shareNote: $('share-note'),
  resultMessage: $('result-message'),
  restart: $('restart'),
  log: $('log'),
};

const converter = new Converter();

const state = {
  /** @type {File | null} */
  file: null,
  /** ffprobe results for `file`, once read */
  info: null,
  /** Why `file` could not be read, if it could not */
  probeError: null,
  /** Length and size the browser read before ffprobe, if it could */
  browserMeta: null,
  /** Incremented on every new selection, so that late results for an old one are dropped. */
  selection: 0,
  probing: false,
  converting: false,
  /** @type {{ blob: Blob, url: string, name: string, info: object | null, sourceSize: number } | null} */
  result: null,
  supported: true,
};

// ---------------------------------------------------------------------------
// Messages and status
//
// What is on screen is kept (as message codes, string keys or functions) so
// that it can be drawn again when the language is switched.

/** @type {Map<HTMLElement, { error: unknown, onRetry?: () => void }>} */
const shownMessages = new Map();
const view = {
  status: { name: 'idle', label: '', detail: '' },
  /** @type {() => string} */
  progressText: () => '',
};

function clearMessage(slot) {
  shownMessages.delete(slot);
  slot.replaceChildren();
}

/**
 * Shows an error (or a notice) with its cause and what to do about it.
 * @param {HTMLElement} slot
 * @param {unknown} error
 * @param {{ onRetry?: () => void }} [options]
 */
function showMessage(slot, error, { onRetry } = {}) {
  shownMessages.set(slot, { error, onRetry });
  renderMessage(slot);
  // A dropped file may be dropped anywhere on the page; bring the message into view.
  if (!slot.closest('[hidden]')) slot.firstChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderMessage(slot) {
  const { error, onRetry } = shownMessages.get(slot);
  const message = describeError(error, lang());
  const box = document.createElement('div');
  box.className = `message message-${message.kind}`;
  box.setAttribute('role', message.kind === 'error' ? 'alert' : 'status');
  box.dataset.code = message.code;

  const title = document.createElement('p');
  title.className = 'message-title';
  title.textContent = message.title;
  const cause = document.createElement('p');
  cause.className = 'message-cause';
  cause.textContent = message.kind === 'error' ? t('message.cause', { cause: message.cause }) : message.cause;
  const fixesTitle = document.createElement('p');
  fixesTitle.className = 'message-fixes-title';
  fixesTitle.textContent = t(message.kind === 'error' ? 'message.fixes' : 'message.next');
  const fixes = document.createElement('ul');
  fixes.className = 'message-fixes';
  for (const fix of message.fixes) {
    const item = document.createElement('li');
    item.textContent = fix;
    fixes.append(item);
  }
  box.append(title, cause, fixesTitle, fixes);

  if (message.retry && onRetry) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button';
    retry.textContent = t('message.retry');
    retry.addEventListener('click', onRetry);
    box.append(retry);
  }
  slot.replaceChildren(box);
}

/**
 * @param {'idle' | 'loading' | 'probing' | 'converting' | 'done' | 'error' | 'canceled'} name
 * @param {string} label key in strings.js
 * @param {{ detail?: string, progress?: boolean }} [options] detail: key in strings.js
 */
function setStatus(name, label, { detail = '', progress = false } = {}) {
  view.status = { name, label, detail };
  el.statusPanel.hidden = name === 'idle';
  el.status.dataset.state = name;
  el.progressArea.hidden = !progress;
  renderStatus();
}

function renderStatus() {
  const { label, detail } = view.status;
  el.statusLabel.textContent = label ? t(label) : '';
  el.statusDetail.textContent = detail ? t(detail) : '';
  el.statusDetail.hidden = !detail;
}

/** @param {number} ratio @param {() => string} [text] the line under the bar */
function setProgress(ratio, text = () => '') {
  const percent = Math.max(0, Math.min(100, Math.floor(ratio * 100)));
  el.progress.value = percent;
  el.progressPercent.textContent = `${percent}%`;
  view.progressText = text;
  el.progressTime.textContent = text();
}

function updateLog() {
  el.log.textContent = converter.log || t('log.empty');
}

// ---------------------------------------------------------------------------
// Settings

function readSettings() {
  const data = new FormData(el.settings);
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = data.get(key);
    if (typeof value === 'string') settings[key] = value;
  }
  return settings;
}

function describePlan(info, plan) {
  const parts = [];
  if (plan.copyVideo) {
    parts.push(t('plan.copy'));
  } else {
    parts.push(t('plan.convert', { codec: codecLabel(info.video.codec, lang()) }));
    const size = formatResolution(plan.width, plan.height);
    parts.push(t(plan.scaled ? 'plan.scaled' : 'plan.keepSize', { size }));
    if (plan.fps) parts.push(t('plan.fps30'));
  }
  if (plan.audio === 'none') {
    parts.push(t(info.audio.length ? 'plan.audioRemove' : 'plan.audioNone'));
  } else {
    parts.push(t(plan.audio === 'copy' ? 'plan.audioCopy' : 'plan.audioAac'));
  }
  return parts.join(t('plan.separator'));
}

function updatePlan() {
  const info = state.info;
  el.h264Mode.hidden = !info?.h264Playable;
  const copyVideo = Boolean(info?.h264Playable) && readSettings().h264Mode === 'copy';
  for (const group of el.videoGroups) group.disabled = state.converting || copyVideo;
  el.audioGroup.disabled = state.converting;
  el.h264Mode.disabled = state.converting;
  if (!info) {
    el.plan.hidden = true;
    return;
  }
  el.plan.textContent = describePlan(info, planConversion(info, readSettings()));
  el.plan.hidden = false;
}

// ---------------------------------------------------------------------------
// Controls

function updateControls() {
  const busy = state.converting;
  const canPick = state.supported && !busy;
  el.pick.disabled = !canPick;
  el.fileInput.disabled = !canPick;
  el.dropzone.classList.toggle('is-disabled', !canPick);
  el.changeFile.disabled = busy;
  el.clearFile.disabled = busy;
  el.restart.disabled = busy;
  el.cancel.hidden = !busy;
  el.cancel.disabled = !busy;

  el.convert.disabled = !state.supported || busy || state.probing;
  el.convert.textContent = t(busy ? 'button.converting' : state.probing ? 'button.checking' : 'button.convert');
  el.convert.setAttribute('aria-busy', String(busy || state.probing));
  updatePlan();
}

// ---------------------------------------------------------------------------
// Choosing a file

function checkFile(file) {
  const ext = fileExtension(file.name);
  const looksLikeVideo = file.type.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
  if (!looksLikeVideo) {
    return new AppError('NOT_VIDEO', { detail: { name: file.name } });
  }
  if (file.size === 0) return new AppError('EMPTY_FILE', { detail: { name: file.name } });
  if (file.size > MAX_FILE_SIZE) {
    return new AppError('TOO_LARGE', {
      detail: { limit: MAX_FILE_SIZE_LABEL, size: formatBytes(file.size) },
    });
  }
  return null;
}

/** The length and size the browser itself can read (not every browser can for HEVC). */
function readBrowserMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 8000);
    video.preload = 'metadata';
    video.muted = true;
    video.addEventListener('loadedmetadata', () =>
      finish({ duration: video.duration, width: video.videoWidth, height: video.videoHeight }),
    );
    video.addEventListener('error', () => finish(null));
    video.src = url;
  });
}

function pending(dd, text) {
  const span = document.createElement('span');
  span.className = 'pending';
  span.textContent = text;
  dd.replaceChildren(span);
}

function withBadge(dd, text, badgeText, badgeClass) {
  const badge = document.createElement('span');
  badge.className = badgeClass;
  badge.textContent = badgeText;
  dd.replaceChildren(document.createTextNode(text), badge);
}

function renderFileInfo() {
  const { file, info } = state;
  el.fileSection.hidden = !file;
  if (!file) return;
  el.infoName.textContent = file.name;
  el.infoSize.textContent = formatBytes(file.size);
  if (!info) {
    const placeholder = state.probing ? t('info.checking') : '—';
    const meta = state.browserMeta;
    for (const dd of [el.infoVideo, el.infoAudio]) pending(dd, placeholder);
    if (meta?.duration) el.infoDuration.textContent = formatDuration(meta.duration, lang());
    else pending(el.infoDuration, placeholder);
    if (meta?.width) el.infoResolution.textContent = formatResolution(meta.width, meta.height);
    else pending(el.infoResolution, placeholder);
    el.infoNote.hidden = true;
    return;
  }
  el.infoDuration.textContent = formatDuration(info.durationSec, lang());
  el.infoResolution.textContent = formatResolution(info.video.displayWidth, info.video.displayHeight);
  const videoLabel = codecLabel(info.video.codec, lang());
  if (info.h264Playable) {
    withBadge(el.infoVideo, videoLabel, t('info.ready'), 'badge-ok');
  } else {
    withBadge(el.infoVideo, videoLabel, t('info.willConvert'), 'badge-convert');
  }
  el.infoAudio.textContent = info.audio.length
    ? info.audio.map((a) => codecLabel(a.codec, lang())).join(t('list.separator')) +
      (info.audio.length > 1 ? t('info.tracks', { count: info.audio.length }) : '')
    : t('info.none');

  const notes = [];
  if (info.video.hdr) notes.push(t('info.hdr'));
  if (info.video.codec === 'h264' && !info.h264Playable) notes.push(t('info.h264Unplayable'));
  el.infoNote.textContent = notes.join(' ');
  el.infoNote.hidden = notes.length === 0;
}

async function loadFFmpeg() {
  if (converter.loaded) return;
  setStatus('loading', 'status.loading', {
    detail: converter.downloaded ? '' : 'status.loadingDetail',
    progress: !converter.downloaded,
  });
  setProgress(0);
  await converter.load({
    onProgress: ({ loaded, total }) => {
      const text = total ? `${formatBytes(loaded)} / ${formatBytes(total)}` : formatBytes(loaded);
      setProgress(total ? loaded / total : 0, () => text);
    },
  });
}

async function selectFile(file) {
  if (state.converting) return;
  clearMessage(el.selectMessage);
  clearMessage(el.runMessage);
  clearResult();

  const problem = checkFile(file);
  if (problem) {
    resetSelection();
    showMessage(el.selectMessage, problem);
    return;
  }

  state.file = file;
  state.info = null;
  state.probeError = null;
  state.browserMeta = null;
  state.probing = true;
  const selection = ++state.selection;
  setStatus('idle', '');
  renderFileInfo();
  updateControls();

  // Quick facts from the browser, while FFmpeg loads.
  readBrowserMetadata(file).then((meta) => {
    if (selection !== state.selection || state.info || !meta) return;
    state.browserMeta = {
      duration: Number.isFinite(meta.duration) && meta.duration > 0 ? meta.duration : null,
      width: meta.width && meta.height ? meta.width : null,
      height: meta.height,
    };
    renderFileInfo();
  });

  try {
    await loadFFmpeg();
    if (selection !== state.selection) return;
    setStatus('probing', 'status.probing');
    const info = await converter.probe(file);
    if (selection !== state.selection) return;
    state.info = info;
    setStatus('idle', '');
  } catch (error) {
    if (selection !== state.selection) return;
    const known = ['LOAD_FAILED', 'OUT_OF_MEMORY', 'NO_VIDEO_STREAM', 'UNREADABLE'];
    state.probeError =
      error instanceof AppError && known.includes(error.code)
        ? error
        : new AppError('UNREADABLE', { cause: error });
    if (state.probeError.code === 'LOAD_FAILED') {
      setStatus('error', 'status.loadFailed');
      showMessage(el.runMessage, state.probeError, { onRetry: () => selectFile(file) });
    } else {
      setStatus('idle', '');
      showMessage(el.selectMessage, state.probeError);
    }
  } finally {
    if (selection === state.selection) {
      state.probing = false;
      renderFileInfo();
      updateControls();
      updateLog();
    }
  }
}

function resetSelection() {
  state.selection += 1;
  state.file = null;
  state.info = null;
  state.probeError = null;
  state.probing = false;
  renderFileInfo();
  updateControls();
}

function clearSelection() {
  if (state.converting) return;
  resetSelection();
  clearResult();
  clearMessage(el.selectMessage);
  clearMessage(el.runMessage);
  setStatus('idle', '');
}

function openPicker() {
  if (el.pick.disabled) return;
  el.fileInput.click();
}

// ---------------------------------------------------------------------------
// Converting

let wakeLock = null;
let cancelRequested = false;

async function keepScreenOn() {
  try {
    // Stops the phone from locking (and pausing the conversion) while converting.
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null; // not supported or not allowed; converting works without it
  }
}

function releaseScreen() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function warnBeforeLeaving(event) {
  event.preventDefault();
  event.returnValue = '';
}

async function startConversion() {
  if (state.converting || state.probing) return;
  clearMessage(el.runMessage);
  if (!state.file) {
    showMessage(el.runMessage, new AppError('NO_FILE'));
    el.pick.focus();
    return;
  }
  if (!state.info && state.probeError?.code === 'LOAD_FAILED') {
    // FFmpeg could not be loaded earlier: try again, then go on if it worked.
    await selectFile(state.file);
    if (!state.info) return;
  } else if (!state.info) {
    // The selected file could not be read; say so again.
    showMessage(el.runMessage, state.probeError ?? new AppError('UNREADABLE'));
    return;
  }

  const { file, info } = state;
  const plan = planConversion(info, readSettings());
  state.converting = true;
  clearResult();
  updateControls();
  window.addEventListener('beforeunload', warnBeforeLeaving);
  keepScreenOn();

  const started = performance.now();
  let ratio = 0;
  const timeText = () => {
    const elapsed = (performance.now() - started) / 1000;
    let text = t('progress.elapsed', { time: formatClock(elapsed) });
    if (ratio >= 0.02 && elapsed >= 3 && ratio < 1) {
      text += t('progress.remaining', { time: formatClock((elapsed * (1 - ratio)) / ratio) });
    }
    return text;
  };
  const tick = () => setProgress(ratio, timeText);
  let timer = null;

  cancelRequested = false;
  try {
    await loadFFmpeg();
    if (cancelRequested) throw new AppError('CANCELED');
    setStatus('converting', plan.copyVideo ? 'status.copying' : 'status.converting', {
      progress: true,
      detail: 'status.convertingDetail',
    });
    tick();
    timer = setInterval(tick, 1000);
    const output = await converter.convert(file, info, plan, {
      onProgress: (value) => {
        ratio = value;
        tick();
      },
    });
    clearInterval(timer);
    ratio = 1;
    tick();
    const blob = new Blob([output.data], { type: 'video/mp4' });
    showResult(blob, output.info, file);
    setStatus('done', 'status.done', { progress: true });
    const took = formatClock((performance.now() - started) / 1000);
    setProgress(1, () => t('progress.took', { time: took }));
    el.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.resultTitle.focus({ preventScroll: true });
  } catch (error) {
    clearInterval(timer);
    const appError = error instanceof AppError ? error : new AppError(error instanceof RangeError ? 'OUT_OF_MEMORY' : 'CONVERT_FAILED', { cause: error });
    if (appError.code === 'CANCELED') {
      setStatus('canceled', 'status.canceled');
    } else {
      setStatus('error', 'status.error');
      console.error(error);
    }
    showMessage(el.runMessage, appError, { onRetry: startConversion });
  } finally {
    clearInterval(timer);
    state.converting = false;
    window.removeEventListener('beforeunload', warnBeforeLeaving);
    releaseScreen();
    updateControls();
    updateLog();
  }
}

function cancelConversion() {
  if (!state.converting) return;
  if (!window.confirm(t('confirm.cancel'))) return;
  el.cancel.disabled = true;
  cancelRequested = true;
  converter.cancel();
}

// ---------------------------------------------------------------------------
// The result

function showResult(blob, outputInfo, sourceFile) {
  const url = URL.createObjectURL(blob);
  const name = outputFileName(sourceFile.name);
  state.result = { blob, url, name, info: outputInfo, sourceSize: sourceFile.size };

  el.previewNote.hidden = el.preview.canPlayType('video/mp4; codecs="avc1.640028"') !== '';
  el.preview.src = url;
  el.outName.textContent = name;
  el.sizeBefore.textContent = formatBytes(sourceFile.size);
  el.sizeAfter.textContent = formatBytes(blob.size);
  renderResult();
  clearMessage(el.resultMessage);
  el.resultSection.hidden = false;
}

/** The parts of the result that depend on the language. */
function renderResult() {
  if (!state.result) return;
  const { blob, info, sourceSize } = state.result;
  el.sizeChange.textContent =
    formatSizeChange(sourceSize, blob.size, lang()) + (blob.size > sourceSize * 1.05 ? t('result.largerHint') : '');
  if (info?.video) {
    const video = info.video;
    el.outVideo.textContent =
      codecLabel(video.codec, lang()) + (video.pixFmt ? t('result.detailSeparator') + video.pixFmt : '');
    el.outResolution.textContent = formatResolution(video.displayWidth, video.displayHeight);
    el.outDuration.textContent = formatDuration(info.durationSec, lang());
    el.outAudio.textContent = info.audio.length
      ? info.audio.map((a) => codecLabel(a.codec, lang())).join(t('list.separator'))
      : t('info.none');
  } else {
    el.outVideo.textContent = codecLabel('h264', lang());
    for (const dd of [el.outResolution, el.outDuration, el.outAudio]) dd.textContent = '—';
  }
}

/** Drops the converted video and the memory behind it. */
function clearResult() {
  if (state.result) URL.revokeObjectURL(state.result.url);
  state.result = null;
  el.preview.pause();
  el.preview.removeAttribute('src');
  el.preview.load();
  el.resultSection.hidden = true;
  clearMessage(el.resultMessage);
}

function download() {
  clearMessage(el.resultMessage);
  try {
    if (!state.result) throw new Error('nothing to download');
    const link = document.createElement('a');
    link.href = state.result.url;
    link.download = state.result.name;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error(error);
    showMessage(el.resultMessage, new AppError('DOWNLOAD_FAILED', { cause: error }));
  }
}

function sharableFile() {
  return new File([state.result.blob], state.result.name, { type: 'video/mp4' });
}

async function share() {
  clearMessage(el.resultMessage);
  if (!state.result) return;
  try {
    const file = sharableFile();
    if (!navigator.canShare?.({ files: [file] })) throw new Error('cannot share files');
    await navigator.share({ files: [file] });
  } catch (error) {
    if (error?.name === 'AbortError') return; // closed by the user
    console.error(error);
    showMessage(el.resultMessage, new AppError('SHARE_FAILED', { cause: error }));
  }
}

function canShareFiles() {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([''], 'test.mp4', { type: 'video/mp4' })] }));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Wiring

function setUpDragAndDrop() {
  let depth = 0;
  const hasFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth += 1;
    if (!el.pick.disabled) el.dropzone.classList.add('is-dragging');
  });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) el.dropzone.classList.remove('is-dragging');
  });
  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    // Without this the browser would open the dropped video itself.
    event.preventDefault();
    event.dataTransfer.dropEffect = el.pick.disabled ? 'none' : 'copy';
  });
  window.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    el.dropzone.classList.remove('is-dragging');
    if (el.pick.disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    selectFile(files[0]);
  });
}

/** Draws everything the scripts wrote again, in the new language. */
function redraw() {
  renderStatus();
  el.progressTime.textContent = view.progressText();
  for (const slot of shownMessages.keys()) renderMessage(slot);
  renderFileInfo();
  renderResult();
  updateControls();
  updateLog();
}

function init() {
  initI18n();
  onLanguageChange(redraw);
  state.supported = browserSupported();
  if (!state.supported) {
    showMessage(el.unsupported, new AppError('UNSUPPORTED_BROWSER'));
  }

  el.pick.addEventListener('click', (event) => {
    event.stopPropagation();
    openPicker();
  });
  el.dropzone.addEventListener('click', openPicker);
  el.changeFile.addEventListener('click', openPicker);
  el.fileInput.addEventListener('change', () => {
    const file = el.fileInput.files?.[0];
    // Cleared so that choosing the same file again still fires "change".
    el.fileInput.value = '';
    if (file) selectFile(file);
  });
  el.clearFile.addEventListener('click', clearSelection);
  el.restart.addEventListener('click', () => {
    clearSelection();
    el.pick.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  el.settings.addEventListener('change', updatePlan);
  el.settings.addEventListener('submit', (event) => event.preventDefault());
  el.convert.addEventListener('click', startConversion);
  el.cancel.addEventListener('click', cancelConversion);
  el.download.addEventListener('click', download);
  el.share.addEventListener('click', share);
  el.share.hidden = !canShareFiles();
  el.shareNote.hidden = el.share.hidden;
  el.preview.addEventListener('error', () => {
    if (state.result) el.previewNote.hidden = false;
  });
  document.addEventListener('visibilitychange', () => {
    // The browser drops the wake lock when the page is hidden; take it again.
    if (state.converting && document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) {
      keepScreenOn();
    }
  });
  setUpDragAndDrop();
  updateControls();
  updateLog();
}

init();
