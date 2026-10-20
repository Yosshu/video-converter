import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, buildArgs, planConversion, scaledSize } from '../../src/ffmpeg-args.js';
import { parseProbe } from '../../src/media-info.js';

const probe = ({ codec = 'hevc', pixFmt = 'yuv420p', width = 886, height = 1920, rate = '60/1', audio = ['aac'] } = {}) =>
  parseProbe({
    streams: [
      { index: 0, codec_type: 'video', codec_name: codec, pix_fmt: pixFmt, width, height, r_frame_rate: rate },
      ...audio.map((codec_name, i) => ({ index: i + 1, codec_type: 'audio', codec_name, channels: 2 })),
    ],
    format: { duration: '10' },
  });

const args = (info, settings = {}) =>
  buildArgs({ input: '/in/input.mp4', output: '/output.mp4', info, plan: planConversion(info, settings) });

const valueAfter = (list, flag) => list[list.indexOf(flag) + 1];

test('HEVC with AAC: video to H.264 yuv420p, AAC copied, MP4 with faststart', () => {
  const a = args(probe());
  assert.deepEqual(a.slice(0, 5), ['-hide_banner', '-loglevel', 'info', '-i', '/in/input.mp4']);
  assert.equal(valueAfter(a, '-c:v'), 'libx264');
  assert.equal(valueAfter(a, '-pix_fmt'), 'yuv420p');
  assert.equal(valueAfter(a, '-crf'), '23');
  assert.equal(valueAfter(a, '-preset'), 'veryfast');
  assert.equal(valueAfter(a, '-fps_mode'), 'vfr');
  assert.equal(valueAfter(a, '-c:a'), 'copy');
  assert.equal(valueAfter(a, '-movflags'), '+faststart');
  assert.equal(valueAfter(a, '-map_metadata'), '-1');
  assert.ok(!a.includes('-vf'), 'no filters needed');
  assert.deepEqual(a.slice(-3), ['-f', 'mp4', '/output.mp4']);
  // Exactly the probed streams are mapped.
  assert.deepEqual(
    a.flatMap((x, i) => (x === '-map' ? [a[i + 1]] : [])),
    ['0:0', '0:1'],
  );
});

test('audio that is not AAC is encoded to AAC; no audio gives -an', () => {
  const opus = args(probe({ audio: ['opus'] }));
  assert.equal(valueAfter(opus, '-c:a'), 'aac');
  assert.equal(valueAfter(opus, '-b:a'), '128k');

  const silent = args(probe({ audio: [] }));
  assert.ok(silent.includes('-an'));
  assert.ok(!silent.includes('-c:a'));

  const removed = args(probe(), { audio: 'remove' });
  assert.ok(removed.includes('-an'));
  assert.deepEqual(
    removed.flatMap((x, i) => (x === '-map' ? [removed[i + 1]] : [])),
    ['0:0'],
  );
});

test('quality and speed choices', () => {
  assert.equal(valueAfter(args(probe(), { quality: 'high' }), '-crf'), '19');
  assert.equal(valueAfter(args(probe(), { quality: 'small' }), '-crf'), '28');
  assert.equal(valueAfter(args(probe(), { speed: 'fast' }), '-preset'), 'superfast');
  // Unknown values fall back to the defaults.
  assert.equal(valueAfter(args(probe(), { quality: 'bogus', speed: 'bogus' }), '-crf'), '23');
});

test('playable H.264 is copied by default, or re-encoded on request', () => {
  const info = probe({ codec: 'h264' });
  const copy = args(info);
  assert.equal(valueAfter(copy, '-c:v'), 'copy');
  assert.ok(!copy.includes('-crf'));
  assert.ok(!copy.includes('-vf'));

  const encode = args(info, { h264Mode: 'encode', maxSize: '1280' });
  assert.equal(valueAfter(encode, '-c:v'), 'libx264');
  assert.match(valueAfter(encode, '-vf'), /^scale=/);

  // 10-bit H.264 is not passed through.
  assert.equal(valueAfter(args(probe({ codec: 'h264', pixFmt: 'yuv420p10le' })), '-c:v'), 'libx264');
});

test('downscaling keeps the aspect ratio and even sizes', () => {
  assert.equal(scaledSize(886, 1920, 1920), null);
  assert.deepEqual(scaledSize(1178, 2556, 1920), { width: 884, height: 1920 });
  assert.deepEqual(scaledSize(2556, 1178, 1280), { width: 1280, height: 590 });
  const plan = planConversion(probe({ width: 1178, height: 2556 }), { maxSize: '1920' });
  assert.equal(plan.scaled, true);
  assert.equal(plan.width, 884);
  assert.equal(valueAfter(args(probe({ width: 1178, height: 2556 }), { maxSize: '1920' }), '-vf'), 'scale=884:1920:flags=lanczos');
});

test('odd sizes are cropped to even ones for yuv420p', () => {
  const plan = planConversion(probe({ codec: 'h264', pixFmt: 'yuv444p', width: 301, height: 161 }), DEFAULT_SETTINGS);
  assert.equal(plan.cropToEven, true);
  assert.equal(plan.width, 300);
  assert.equal(plan.height, 160);
  const a = args(probe({ width: 301, height: 161 }));
  assert.equal(valueAfter(a, '-vf'), 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0');
});

test('30 fps cap only applies to faster videos', () => {
  assert.equal(valueAfter(args(probe({ rate: '60/1' }), { fps: '30' }), '-vf'), 'fps=30');
  assert.ok(!args(probe({ rate: '30/1' }), { fps: '30' }).includes('-vf'));
  assert.ok(!args(probe({ rate: '60/1' })).includes('-vf'));
});

test('filters are chained in order: frame rate, size, crop', () => {
  const a = args(probe({ width: 1281, height: 2561, rate: '60/1' }), { fps: '30', maxSize: '1920' });
  assert.equal(valueAfter(a, '-vf'), 'fps=30,scale=960:1920:flags=lanczos');
});
