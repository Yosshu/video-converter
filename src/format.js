// Formatting helpers for what the page shows. No DOM access, so they can be
// unit-tested in Node.

/** Bytes as "12.3 MB" (1 MB = 1024 × 1024 bytes, as Windows shows it). */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/** Seconds as "1分05秒" / "12秒" / "1時間02分03秒". */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds > 0 && seconds < 1) return '1秒未満';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}時間${pad(m)}分${pad(s)}秒`;
  if (m > 0) return `${m}分${pad(s)}秒`;
  return `${s}秒`;
}

/** Seconds as a clock, "0:42" / "12:03" / "1:02:03", for elapsed/remaining time. */
export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function formatResolution(width, height) {
  if (!width || !height) return '—';
  return `${width} × ${height}`;
}

/** How the size changed, e.g. "45% 小さくなりました". */
export function formatSizeChange(before, after) {
  if (!before || !Number.isFinite(after)) return '';
  const ratio = after / before;
  const percent = Math.round(Math.abs(1 - ratio) * 100);
  if (percent === 0) return 'ほぼ同じ大きさです';
  return ratio < 1 ? `${percent}% 小さくなりました` : `${percent}% 大きくなりました`;
}

/** "ScreenRecording.MP4" → "ScreenRecording_H264.mp4". */
export function outputFileName(inputName) {
  const name = String(inputName ?? '').trim();
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base || 'video'}_H264.mp4`;
}

/** The extension of a file name in lower case, without the dot ("" when none). */
export function fileExtension(name) {
  const dot = String(name ?? '').lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}
