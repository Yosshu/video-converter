// Switching the page between Japanese and English.
//
// The pages are written in Japanese. Elements with data-i18n="key" (text) or
// data-i18n-attr="attribute:key,…" are translated from strings.js; their
// Japanese is read from the page itself when switching back. Text that the
// scripts write is looked up with t().

import { LANGUAGES, translate } from './strings.js';

const STORAGE_KEY = 'video-converter.lang'; // also read by lang-boot.js
const root = document.documentElement;

let current = LANGUAGES.includes(root.lang) ? root.lang : 'ja';
const listeners = new Set();
/** The Japanese written in the page, per element. */
const originals = new WeakMap();

/** The current language, "ja" or "en". */
export const lang = () => current;

/** The text for a key in the current language; `{name}` is filled from params. */
export const t = (key, params) => translate(current, key, params);

/** Calls `listener(lang)` after the language changes. */
export const onLanguageChange = (listener) => listeners.add(listener);

function parseAttrs(spec) {
  return spec.split(',').map((pair) => pair.split(':').map((part) => part.trim()));
}

function capture() {
  for (const node of document.querySelectorAll('[data-i18n], [data-i18n-attr]')) {
    if (originals.has(node)) continue;
    const attrs = {};
    for (const [name] of parseAttrs(node.dataset.i18nAttr ?? '')) {
      if (name) attrs[name] = node.getAttribute(name);
    }
    originals.set(node, { text: node.textContent, attrs });
  }
}

function applyStatic() {
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = current === 'ja' ? originals.get(node).text : t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-attr]')) {
    for (const [name, key] of parseAttrs(node.dataset.i18nAttr)) {
      if (!name) continue;
      node.setAttribute(name, current === 'ja' ? originals.get(node).attrs[name] : t(key));
    }
  }
  // Links to the other page keep the language (in case it cannot be stored).
  for (const link of document.querySelectorAll('a[data-keep-lang]')) {
    const url = new URL(link.getAttribute('href'), location.href);
    url.searchParams.set('lang', current);
    link.href = url.href;
  }
  for (const button of document.querySelectorAll('[data-set-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.setLang === current));
  }
}

/** Switches the language, remembers the choice and puts it in the URL. */
export function setLanguage(next) {
  if (!LANGUAGES.includes(next) || next === current) return;
  current = next;
  root.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage may be blocked (private mode); the URL still carries the choice.
  }
  const url = new URL(location.href);
  url.searchParams.set('lang', next);
  history.replaceState(history.state, '', url);
  applyStatic();
  for (const listener of listeners) listener(next);
}

/** Translates the page into the language lang-boot.js chose and wires the switch. */
export function initI18n() {
  capture();
  applyStatic();
  for (const button of document.querySelectorAll('[data-set-lang]')) {
    button.addEventListener('click', () => setLanguage(button.dataset.setLang));
  }
  root.removeAttribute('data-i18n-pending');
}
