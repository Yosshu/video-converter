import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codecLabel, parseProbe } from '../../src/media-info.js';

// Trimmed ffprobe output for an iPhone screen recording.
const iphoneScreenRecording = {
  streams: [
    {
      index: 0,
      codec_name: 'hevc',
      profile: 'Main',
      codec_type: 'video',
      width: 886,
      height: 1920,
      pix_fmt: 'yuv420p',
      color_transfer: 'bt709',
      r_frame_rate: '60/1',
      avg_frame_rate: '23580/1193',
      duration: '12.345000',
      disposition: { attached_pic: 0 },
    },
    { index: 1, codec_name: 'aac', codec_type: 'audio', channels: 2 },
    { index: 2, codec_name: 'none', codec_type: 'data' },
  ],
  format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '12.400000' },
};

test('reads an iPhone screen recording', () => {
  const info = parseProbe(iphoneScreenRecording);
  assert.equal(info.durationSec, 12.4);
  assert.equal(info.video.codec, 'hevc');
  assert.equal(info.video.label, 'HEVC（H.265）');
  assert.equal(info.video.displayWidth, 886);
  assert.equal(info.video.displayHeight, 1920);
  assert.equal(info.video.maxFps, 60);
  assert.equal(info.video.hdr, false);
  assert.equal(info.h264Playable, false);
  assert.equal(info.audioIsAac, true);
  assert.deepEqual(
    info.streams.map((s) => s.type),
    ['video', 'audio', 'data'],
  );
});

test('swaps width and height for a rotated video', () => {
  const info = parseProbe({
    streams: [
      {
        index: 0,
        codec_type: 'video',
        codec_name: 'hevc',
        width: 1920,
        height: 1080,
        side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }],
      },
    ],
    format: { duration: '3' },
  });
  assert.equal(info.video.rotation, 270);
  assert.equal(info.video.displayWidth, 1080);
  assert.equal(info.video.displayHeight, 1920);
  assert.deepEqual(info.audio, []);
  assert.equal(info.audioIsAac, false);
});

test('knows which H.264 can be passed through', () => {
  const h264 = (pix_fmt) =>
    parseProbe({ streams: [{ index: 0, codec_type: 'video', codec_name: 'h264', pix_fmt, width: 2, height: 2 }] });
  assert.equal(h264('yuv420p').h264Playable, true);
  assert.equal(h264('yuvj420p').h264Playable, true);
  assert.equal(h264('yuv420p10le').h264Playable, false);
  assert.equal(h264('yuv444p').h264Playable, false);
});

test('flags HDR video and its bit depth', () => {
  const info = parseProbe({
    streams: [
      { index: 0, codec_type: 'video', codec_name: 'hevc', pix_fmt: 'yuv420p10le', color_transfer: 'arib-std-b67', width: 4, height: 4 },
    ],
  });
  assert.equal(info.video.hdr, true);
  assert.equal(info.video.bitDepth, 10);
  assert.equal(info.durationSec, null);
});

test('ignores cover art and handles audio-only files', () => {
  const info = parseProbe({
    streams: [
      { index: 0, codec_type: 'audio', codec_name: 'aac' },
      { index: 1, codec_type: 'video', codec_name: 'mjpeg', disposition: { attached_pic: 1 } },
    ],
  });
  assert.equal(info.video, null);
  assert.equal(info.h264Playable, false);
});

test('codecLabel', () => {
  assert.equal(codecLabel('h264'), 'H.264（AVC）');
  assert.equal(codecLabel('pcm_s16le'), 'PCM（非圧縮）');
  assert.equal(codecLabel('apac'), 'APAC');
  assert.equal(codecLabel(''), '不明');
});
