import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { STRINGS, translate } from '../../src/strings.js';

const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();

test('every text the scripts write has an English version with the same placeholders', () => {
  for (const [key, ja] of Object.entries(STRINGS.ja)) {
    assert.ok(STRINGS.en[key], `missing English for ${key}`);
    assert.deepEqual(placeholders(STRINGS.en[key]), placeholders(ja), key);
  }
});

test('every data-i18n key in the pages has an English version', () => {
  for (const page of ['index.html', 'licenses.html']) {
    const html = readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8');
    const keys = [
      ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((p) => p.split(':')[1])),
    ];
    assert.ok(keys.length > 10, page);
    for (const key of keys) assert.ok(STRINGS.en[key], `${page}: missing English for ${key}`);
  }
});

test('English text contains no Japanese', () => {
  for (const [key, text] of Object.entries(STRINGS.en)) {
    assert.doesNotMatch(text, /[぀-ヿ一-鿿]/, key);
  }
});

test('translate fills placeholders and falls back to Japanese', () => {
  assert.equal(translate('en', 'progress.took', { time: '0:42' }), 'Took 0:42');
  assert.equal(translate('ja', 'progress.took', { time: '0:42' }), 'かかった時間 0:42');
  assert.equal(translate('fr', 'status.done'), '変換が完了しました');
  assert.equal(translate('en', 'no.such.key'), 'no.such.key');
});
