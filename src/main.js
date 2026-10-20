// The page: choosing a file, settings, progress and the result.
// All video work happens in converter.js (inside a Web Worker).

import { Converter, browserSupported } from './converter.js';
import { AppError, describeError } from './errors.js';
import { DEFAULT_SETTINGS, planConversion } from './ffmpeg-args.js';
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
  /** Incremented on every new selection, so that late results for an old one are dropped. */
  selection: 0,
  probing: false,
  converting: false,
  /** @type {{ blob: Blob, url: string, name: string } | null} */
  result: null,
  supported: true,
};

// ---------------------------------------------------------------------------
// Messages and status

function clearMessage(slot) {
  slot.replaceChildren();
}

/**
 * Shows an error (or a notice) with its cause and what to do about it.
 * @param {HTMLElement} slot
 * @param {unknown} error
 * @param {{ onRetry?: () => void }} [options]
 */
function showMessage(slot, error, { onRetry } = {}) {
  const message = describeError(error);
  const box = document.createElement('div');
  box.className = `message message-${message.kind}`;
  box.setAttribute('role', message.kind === 'error' ? 'alert' : 'status');
  box.dataset.code = message.code;

  const title = document.createElement('p');
  title.className = 'message-title';
  title.textContent = message.title;
  const cause = document.createElement('p');
  cause.className = 'message-cause';
  cause.textContent = `${message.kind === 'error' ? '原因：' : ''}${message.cause}`;
  const fixesTitle = document.createElement('p');
  fixesTitle.className = 'message-fixes-title';
  fixesTitle.textContent = message.kind === 'error' ? '対処方法' : 'このあとは';
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
    retry.textContent = 'もう一度試す';
    retry.addEventListener('click', onRetry);
    box.append(retry);
  }
  slot.replaceChildren(box);
  // A dropped file may be dropped anywhere on the page; bring the message into view.
  if (!slot.closest('[hidden]')) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * @param {'idle' | 'loading' | 'probing' | 'converting' | 'done' | 'error' | 'canceled'} name
 * @param {string} label
 * @param {{ detail?: string, progress?: boolean }} [options]
 */
function setStatus(name, label, { detail = '', progress = false } = {}) {
  el.statusPanel.hidden = name === 'idle';
  el.status.dataset.state = name;
  el.statusLabel.textContent = label;
  el.statusDetail.textContent = detail;
  el.statusDetail.hidden = !detail;
  el.progressArea.hidden = !progress;
}

function setProgress(ratio, timeText = '') {
  const percent = Math.max(0, Math.min(100, Math.floor(ratio * 100)));
  el.progress.value = percent;
  el.progressPercent.textContent = `${percent}%`;
  el.progressTime.textContent = timeText;
}

function updateLog() {
  el.log.textContent = converter.log || '（まだありません）';
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
    parts.push('映像：作り直さずに MP4 へ入れ直します（画質そのまま）');
  } else {
    parts.push(`映像：${info.video.label} → H.264 に変換`);
    const size = formatResolution(plan.width, plan.height);
    parts.push(plan.scaled ? `解像度：${size} に縮小` : `解像度：${size}（そのまま）`);
    if (plan.fps) parts.push('1秒30コマまで');
  }
  if (plan.audio === 'none') {
    parts.push(info.audio.length ? '音声：消す' : '音声：なし');
  } else {
    parts.push(plan.audio === 'copy' ? '音声：AAC のまま' : '音声：AAC に変換');
  }
  return parts.join(' ／ ');
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
  if (busy) el.convert.textContent = '変換中…';
  else if (state.probing) el.convert.textContent = '動画を確認中…';
  else el.convert.textContent = '変換開始';
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

function pending(dd, text = '確認中…') {
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
    for (const dd of [el.infoVideo, el.infoAudio]) pending(dd, state.probing ? '確認中…' : '—');
    if (!el.infoDuration.dataset.known) pending(el.infoDuration, state.probing ? '確認中…' : '—');
    if (!el.infoResolution.dataset.known) pending(el.infoResolution, state.probing ? '確認中…' : '—');
    el.infoNote.hidden = true;
    return;
  }
  el.infoDuration.textContent = formatDuration(info.durationSec);
  el.infoResolution.textContent = formatResolution(info.video.displayWidth, info.video.displayHeight);
  if (info.h264Playable) {
    withBadge(el.infoVideo, info.video.label, 'そのまま使えます', 'badge-ok');
  } else {
    withBadge(el.infoVideo, info.video.label, 'H.264 に変換します', 'badge-convert');
  }
  el.infoAudio.textContent = info.audio.length
    ? info.audio.map((a) => a.label).join('、') + (info.audio.length > 1 ? `（${info.audio.length}トラック）` : '')
    : 'なし';

  const notes = [];
  if (info.video.hdr) {
    notes.push('HDR（明るさの幅が広い）動画です。変換後は一般的な色合い（SDR）として保存されるため、色が薄く見えることがあります。');
  }
  if (info.video.codec === 'h264' && !info.h264Playable) {
    notes.push('H.264 ですが、一部の再生環境で再生できない形式（10bit や 4:4:4 など）のため、変換し直します。');
  }
  el.infoNote.textContent = notes.join(' ');
  el.infoNote.hidden = notes.length === 0;
}

async function loadFFmpeg() {
  if (converter.loaded) return;
  setStatus('loading', '変換プログラム（FFmpeg）を準備しています…', {
    detail: converter.downloaded ? '' : '初回は約 31MB をダウンロードします。2 回目以降は短時間で終わります。',
    progress: !converter.downloaded,
  });
  setProgress(0, '');
  await converter.load({
    onProgress: ({ loaded, total }) => {
      if (total) setProgress(loaded / total, `${formatBytes(loaded)} / ${formatBytes(total)}`);
      else el.progressTime.textContent = formatBytes(loaded);
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
  state.probing = true;
  const selection = ++state.selection;
  delete el.infoDuration.dataset.known;
  delete el.infoResolution.dataset.known;
  setStatus('idle', '');
  renderFileInfo();
  updateControls();

  // Quick facts from the browser, while FFmpeg loads.
  readBrowserMetadata(file).then((meta) => {
    if (selection !== state.selection || state.info || !meta) return;
    if (Number.isFinite(meta.duration) && meta.duration > 0) {
      el.infoDuration.textContent = formatDuration(meta.duration);
      el.infoDuration.dataset.known = '1';
    }
    if (meta.width && meta.height) {
      el.infoResolution.textContent = formatResolution(meta.width, meta.height);
      el.infoResolution.dataset.known = '1';
    }
  });

  try {
    await loadFFmpeg();
    if (selection !== state.selection) return;
    setStatus('probing', '動画を確認しています…');
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
      setStatus('error', 'FFmpeg を読み込めませんでした');
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
  const tick = () => {
    const elapsed = (performance.now() - started) / 1000;
    let text = `経過 ${formatClock(elapsed)}`;
    if (ratio >= 0.02 && elapsed >= 3 && ratio < 1) {
      text += ` ・ 残り 約${formatClock((elapsed * (1 - ratio)) / ratio)}`;
    }
    setProgress(ratio, text);
  };
  let timer = null;

  cancelRequested = false;
  try {
    await loadFFmpeg();
    if (cancelRequested) throw new AppError('CANCELED');
    setStatus('converting', plan.copyVideo ? 'MP4 に入れ直しています…' : 'H.264 に変換しています…', {
      progress: true,
      detail: '変換が終わるまで、この画面を開いたままにしてください。',
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
    setStatus('done', '変換が完了しました', { progress: true });
    setProgress(1, `かかった時間 ${formatClock((performance.now() - started) / 1000)}`);
    el.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.resultTitle.focus({ preventScroll: true });
  } catch (error) {
    clearInterval(timer);
    const appError = error instanceof AppError ? error : new AppError(error instanceof RangeError ? 'OUT_OF_MEMORY' : 'CONVERT_FAILED', { cause: error });
    if (appError.code === 'CANCELED') {
      setStatus('canceled', '変換をキャンセルしました');
    } else {
      setStatus('error', 'エラーが発生しました');
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
  if (!window.confirm('変換を中止しますか？ここまでの変換内容は失われます。')) return;
  el.cancel.disabled = true;
  cancelRequested = true;
  converter.cancel();
}

// ---------------------------------------------------------------------------
// The result

function showResult(blob, outputInfo, sourceFile) {
  const url = URL.createObjectURL(blob);
  const name = outputFileName(sourceFile.name);
  state.result = { blob, url, name };

  el.previewNote.hidden = el.preview.canPlayType('video/mp4; codecs="avc1.640028"') !== '';
  el.preview.src = url;
  el.sizeBefore.textContent = formatBytes(sourceFile.size);
  el.sizeAfter.textContent = formatBytes(blob.size);
  el.sizeChange.textContent =
    formatSizeChange(sourceFile.size, blob.size) +
    (blob.size > sourceFile.size * 1.05 ? '（画質を「小さめ」にすると小さくできます）' : '');
  el.outName.textContent = name;
  if (outputInfo?.video) {
    const video = outputInfo.video;
    el.outVideo.textContent = `${video.label}${video.pixFmt ? `・${video.pixFmt}` : ''}`;
    el.outResolution.textContent = formatResolution(video.displayWidth, video.displayHeight);
    el.outDuration.textContent = formatDuration(outputInfo.durationSec);
    el.outAudio.textContent = outputInfo.audio.length ? outputInfo.audio.map((a) => a.label).join('、') : 'なし';
  } else {
    el.outVideo.textContent = 'H.264（AVC）';
    for (const dd of [el.outResolution, el.outDuration, el.outAudio]) dd.textContent = '—';
  }
  el.download.textContent = 'ダウンロード';
  clearMessage(el.resultMessage);
  el.resultSection.hidden = false;
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

function init() {
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
}

init();
