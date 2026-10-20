// Decides how a video is converted and builds the ffmpeg command line.
// No DOM access, so it can be unit-tested in Node.

/** Constant Rate Factor per quality choice: lower is sharper and larger. */
export const QUALITY_CRF = {
  high: 19,
  standard: 23,
  small: 28,
};

/**
 * x264 preset per speed choice. Measured in WebAssembly on a 10 s, 886×1920,
 * 60 fps screen recording at CRF 23: superfast 49 s / 7.1 MB, veryfast
 * 73 s / 2.5 MB, faster 121 s / 2.4 MB, medium 156 s / 3.0 MB, and
 * ultrafast made a 36 MB file. Slower presets are left out because they take
 * far longer without making the file smaller.
 */
export const SPEED_PRESET = {
  fast: 'superfast',
  standard: 'veryfast',
};

export const MAX_SIZES = ['source', '1920', '1280'];

export const DEFAULT_SETTINGS = Object.freeze({
  quality: 'standard',
  speed: 'standard',
  maxSize: 'source',
  fps: 'source',
  audio: 'keep',
  // What to do with a video that is already playable H.264.
  h264Mode: 'copy',
});

export const AUDIO_BITRATE = '128k';

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/**
 * The output size for a "longest side at most N px" setting, or null when the
 * video is already small enough. Keeps the aspect ratio, rounds to even sizes.
 */
export function scaledSize(width, height, maxSide) {
  const longest = Math.max(width, height);
  if (!maxSide || !longest || longest <= maxSide) return null;
  const factor = maxSide / longest;
  return width >= height
    ? { width: maxSide, height: even(height * factor) }
    : { width: even(width * factor), height: maxSide };
}

/**
 * What will be done with the video, for the page to describe and for
 * buildArgs to follow.
 *
 * @param {ReturnType<import('./media-info.js').parseProbe>} info
 * @param {typeof DEFAULT_SETTINGS} settings
 */
export function planConversion(info, settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const video = info.video;
  const copyVideo = info.h264Playable && s.h264Mode === 'copy';

  let audio = 'none';
  if (s.audio !== 'remove' && info.audio.length > 0) {
    audio = info.audioIsAac ? 'copy' : 'aac';
  }

  let size = { width: video.displayWidth, height: video.displayHeight };
  let scaled = false;
  let fps = null;
  if (!copyVideo) {
    const target = scaledSize(size.width, size.height, Number(s.maxSize) || 0);
    if (target) {
      size = target;
      scaled = true;
    }
    if (s.fps === '30' && !(video.maxFps && video.maxFps <= 30.5)) fps = 30;
  }

  return {
    copyVideo,
    audio,
    scaled,
    // yuv420p needs even sizes; an odd row or column is cropped off.
    cropToEven: !copyVideo && (size.width % 2 !== 0 || size.height % 2 !== 0),
    width: copyVideo ? size.width : size.width - (size.width % 2),
    height: copyVideo ? size.height : size.height - (size.height % 2),
    fps,
    crf: QUALITY_CRF[s.quality] ?? QUALITY_CRF.standard,
    preset: SPEED_PRESET[s.speed] ?? SPEED_PRESET.standard,
    downmix: audio === 'aac' && info.audio.some((a) => a.channels > 2),
  };
}

/**
 * The ffmpeg arguments (after the implicit "ffmpeg -nostdin -y").
 *
 * @param {{ input: string, output: string, info: ReturnType<import('./media-info.js').parseProbe>, plan: ReturnType<typeof planConversion> }} options
 */
export function buildArgs({ input, output, info, plan }) {
  // The log level is given every time: ffmpeg.wasm keeps it between commands.
  const args = ['-hide_banner', '-loglevel', 'info', '-i', input];

  args.push('-map', `0:${info.video.index}`);
  if (plan.audio !== 'none') {
    for (const a of info.audio) args.push('-map', `0:${a.index}`);
  }
  // Leave out file metadata such as the recording location.
  args.push('-map_metadata', '-1', '-map_chapters', '-1');

  if (plan.copyVideo) {
    args.push('-c:v', 'copy');
  } else {
    const filters = [];
    if (plan.fps) filters.push(`fps=${plan.fps}`);
    if (plan.scaled) filters.push(`scale=${plan.width}:${plan.height}:flags=lanczos`);
    if (plan.cropToEven) filters.push('crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0');
    if (filters.length) args.push('-vf', filters.join(','));
    args.push(
      '-c:v', 'libx264',
      '-preset', plan.preset,
      '-crf', String(plan.crf),
      '-pix_fmt', 'yuv420p',
      // Keep the original frame timing; iPhone screen recordings have a
      // variable frame rate and padding it to a constant one only adds frames.
      '-fps_mode', 'vfr',
    );
  }

  if (plan.audio === 'none') {
    args.push('-an');
  } else if (plan.audio === 'copy') {
    args.push('-c:a', 'copy');
  } else {
    args.push('-c:a', 'aac', '-b:a', AUDIO_BITRATE);
    if (plan.downmix) args.push('-ac', '2');
  }

  args.push('-movflags', '+faststart', '-f', 'mp4', output);
  return args;
}
