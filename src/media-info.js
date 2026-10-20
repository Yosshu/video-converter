// Turns ffprobe's JSON output into the few facts the app needs.
// No DOM access, so it can be unit-tested in Node.

const CODEC_LABELS = {
  hevc: 'HEVC（H.265）',
  h264: 'H.264（AVC）',
  av1: 'AV1',
  vp9: 'VP9',
  vp8: 'VP8',
  prores: 'ProRes',
  mpeg4: 'MPEG-4',
  aac: 'AAC',
  alac: 'ALAC',
  mp3: 'MP3',
  opus: 'Opus',
  ac3: 'AC-3',
  eac3: 'E-AC-3',
  flac: 'FLAC',
  vorbis: 'Vorbis',
};

/** A readable name for an ffprobe codec_name. */
export function codecLabel(codec) {
  if (!codec) return '不明';
  if (CODEC_LABELS[codec]) return CODEC_LABELS[codec];
  if (codec.startsWith('pcm_')) return 'PCM（非圧縮）';
  return codec.toUpperCase();
}

// Pixel formats that H.264 players everywhere can decode (8-bit 4:2:0).
const PLAYABLE_H264_PIX_FMTS = new Set(['yuv420p', 'yuvj420p']);
// Transfer characteristics of HDR video (PQ and HLG, as in iPhone camera video).
const HDR_TRANSFERS = new Set(['smpte2084', 'arib-std-b67']);

function parseRate(rate) {
  const [num, den] = String(rate ?? '').split('/').map(Number);
  if (!num || !den) return null;
  return num / den;
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function rotationOf(stream) {
  const matrix = (stream.side_data_list ?? []).find((d) => typeof d.rotation === 'number');
  const raw = matrix?.rotation ?? Number(stream.tags?.rotate ?? 0);
  // Normalise to 0, 90, 180 or 270.
  return ((Math.round(raw / 90) * 90) % 360 + 360) % 360;
}

function bitDepthOf(pixFmt) {
  const match = /p(\d{2})(le|be)?$/.exec(pixFmt ?? '');
  return match ? Number(match[1]) : 8;
}

/**
 * @param {object} probe parsed `ffprobe -show_format -show_streams -print_format json`
 * @returns {{
 *   durationSec: number | null,
 *   formatName: string,
 *   video: null | {
 *     index: number, codec: string, label: string, profile: string, pixFmt: string,
 *     width: number, height: number, displayWidth: number, displayHeight: number,
 *     rotation: number, fps: number | null, maxFps: number | null, bitDepth: number,
 *     hdr: boolean,
 *   },
 *   audio: { index: number, codec: string, label: string, channels: number }[],
 *   streams: { index: number, type: string, codec: string }[],
 *   h264Playable: boolean,
 *   audioIsAac: boolean,
 * }}
 */
export function parseProbe(probe) {
  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const format = probe?.format ?? {};

  const videoStream = streams.find(
    (s) => s.codec_type === 'video' && !s.disposition?.attached_pic,
  );
  let video = null;
  if (videoStream) {
    const width = Number(videoStream.width) || 0;
    const height = Number(videoStream.height) || 0;
    const rotation = rotationOf(videoStream);
    const sideways = rotation === 90 || rotation === 270;
    const pixFmt = videoStream.pix_fmt ?? '';
    video = {
      index: videoStream.index,
      codec: videoStream.codec_name ?? '',
      label: codecLabel(videoStream.codec_name),
      profile: videoStream.profile ?? '',
      pixFmt,
      width,
      height,
      displayWidth: sideways ? height : width,
      displayHeight: sideways ? width : height,
      rotation,
      fps: parseRate(videoStream.avg_frame_rate) ?? parseRate(videoStream.r_frame_rate),
      // The highest rate the stream reaches; iPhone screen recordings vary
      // their frame rate, so the average alone understates it.
      maxFps: parseRate(videoStream.r_frame_rate) ?? parseRate(videoStream.avg_frame_rate),
      bitDepth: bitDepthOf(pixFmt),
      hdr: HDR_TRANSFERS.has(videoStream.color_transfer),
    };
  }

  const audio = streams
    .filter((s) => s.codec_type === 'audio')
    .map((s) => ({
      index: s.index,
      codec: s.codec_name ?? '',
      label: codecLabel(s.codec_name),
      channels: Number(s.channels) || 0,
    }));

  const durationSec =
    parseNumber(format.duration) ?? parseNumber(videoStream?.duration) ?? null;

  return {
    durationSec,
    formatName: format.format_name ?? '',
    video,
    audio,
    streams: streams.map((s) => ({
      index: s.index,
      type: s.codec_type ?? '',
      codec: s.codec_name ?? '',
    })),
    h264Playable: Boolean(
      video && video.codec === 'h264' && PLAYABLE_H264_PIX_FMTS.has(video.pixFmt),
    ),
    audioIsAac: audio.length > 0 && audio.every((a) => a.codec === 'aac'),
  };
}
