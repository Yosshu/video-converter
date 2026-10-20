import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError, MESSAGES, classifyFailure, describeError } from '../../src/errors.js';
import { parseProbe } from '../../src/media-info.js';

test('every message has a title, a cause and fixes in both languages', () => {
  for (const [code, message] of Object.entries(MESSAGES)) {
    for (const lang of ['ja', 'en']) {
      assert.ok(message[lang].title, `${code} ${lang}`);
      assert.ok(message[lang].cause, `${code} ${lang}`);
      assert.ok(message[lang].fixes.length > 0, `${code} ${lang}`);
    }
    assert.equal(message.en.fixes.length, message.ja.fixes.length, code);
    // The same placeholders in both languages.
    const placeholders = (text) => JSON.stringify(text).match(/\{\w+\}/g)?.sort() ?? [];
    assert.deepEqual(placeholders(message.en), placeholders(message.ja), code);
  }
});

test('describeError fills in details', () => {
  const error = new AppError('TOO_LARGE', { detail: { limit: '2GB', size: '3.1 GB' } });
  const message = describeError(error);
  assert.equal(message.code, 'TOO_LARGE');
  assert.equal(message.kind, 'error');
  assert.match(message.cause, /2GB までです（選ばれた動画: 3\.1 GB）/);
  assert.match(describeError(error, 'en').cause, /up to 2GB \(selected video: 3\.1 GB\)/);
  assert.equal(describeError(new AppError('CANCELED')).kind, 'info');
  assert.equal(describeError(new AppError('LOAD_FAILED')).retry, true);
  // Anything unexpected is reported as a conversion error.
  assert.equal(describeError(new TypeError('x')).code, 'CONVERT_FAILED');
  assert.equal(describeError(new TypeError('x'), 'en').title, 'Something went wrong while converting');
});

test('classifyFailure recognises broken input', () => {
  assert.equal(
    classifyFailure(['[mov,mp4,m4a,3gp,3g2,mj2 @ 0xdee950] moov atom not found', '/in/input.mp4: Invalid data found when processing input']).code,
    'UNREADABLE',
  );
});

test('classifyFailure recognises running out of memory', () => {
  assert.equal(classifyFailure(['Error while filtering: Cannot allocate memory']).code, 'OUT_OF_MEMORY');
  assert.equal(classifyFailure([], { error: 'RuntimeError: memory access out of bounds' }).code, 'OUT_OF_MEMORY');
  assert.equal(classifyFailure([], { error: new RangeError('Array buffer allocation failed') }).code, 'OUT_OF_MEMORY');
});

test('classifyFailure tells an unsupported audio track from an unsupported video', () => {
  const info = parseProbe({
    streams: [
      { index: 0, codec_type: 'video', codec_name: 'hevc', width: 2, height: 2 },
      { index: 1, codec_type: 'audio', codec_name: 'apac' },
    ],
  });
  const audio = classifyFailure(['Decoder (codec none) not found for input stream #0:1'], { info });
  assert.equal(audio.code, 'AUDIO_UNSUPPORTED');
  assert.equal(audio.detail.codec, 'apac');
  assert.equal(classifyFailure(['Decoder (codec none) not found for input stream #0:0'], { info }).code, 'UNREADABLE');
});

test('classifyFailure falls back to a general conversion error', () => {
  assert.equal(classifyFailure(['Conversion failed!']).code, 'CONVERT_FAILED');
});
