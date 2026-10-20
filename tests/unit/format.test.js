import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fileExtension,
  formatBytes,
  formatClock,
  formatDuration,
  formatResolution,
  formatSizeChange,
  outputFileName,
} from '../../src/format.js';

test('formatBytes uses 1024-based units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1023), '1023 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(250 * 1024 * 1024), '250 MB');
  assert.equal(formatBytes(2 * 1024 ** 3), '2.0 GB');
  assert.equal(formatBytes(NaN), '—');
});

test('formatDuration writes Japanese units', () => {
  assert.equal(formatDuration(0.4), '1秒未満');
  assert.equal(formatDuration(12.4), '12秒');
  assert.equal(formatDuration(65), '1分05秒');
  assert.equal(formatDuration(3723), '1時間02分03秒');
  assert.equal(formatDuration(null), '—');
});

test('formatClock', () => {
  assert.equal(formatClock(5), '0:05');
  assert.equal(formatClock(754), '12:34');
  assert.equal(formatClock(3723), '1:02:03');
});

test('formatResolution and formatSizeChange', () => {
  assert.equal(formatResolution(886, 1920), '886 × 1920');
  assert.equal(formatResolution(0, 0), '—');
  assert.equal(formatSizeChange(100, 55), '45% 小さくなりました');
  assert.equal(formatSizeChange(100, 130), '30% 大きくなりました');
  assert.equal(formatSizeChange(100, 100.2), 'ほぼ同じ大きさです');
});

test('outputFileName adds _H264 and always ends in .mp4', () => {
  assert.equal(outputFileName('ScreenRecording_10-20-2026 08-11-00_1.MP4'), 'ScreenRecording_10-20-2026 08-11-00_1_H264.mp4');
  assert.equal(outputFileName('IMG_0001.MOV'), 'IMG_0001_H264.mp4');
  assert.equal(outputFileName('画面収録.mov'), '画面収録_H264.mp4');
  assert.equal(outputFileName('archive.tar.mp4'), 'archive.tar_H264.mp4');
  assert.equal(outputFileName('noext'), 'noext_H264.mp4');
  assert.equal(outputFileName('.mp4'), '.mp4_H264.mp4');
  assert.equal(outputFileName(''), 'video_H264.mp4');
});

test('fileExtension', () => {
  assert.equal(fileExtension('a.MOV'), 'mov');
  assert.equal(fileExtension('a'), '');
  assert.equal(fileExtension('.hidden'), '');
});
