// Picks the page language before the page is drawn, so that English readers
// do not see the Japanese text flash first. A classic (blocking) script on
// purpose; src/i18n.js takes over from what it sets on <html>.
//
// Order: ?lang= in the URL, then the language chosen earlier with the switch,
// then the browser's preferred language (Japanese → ja, anything else → en).
(function () {
  var supported = { ja: true, en: true };
  var lang = null;
  try {
    var param = new URLSearchParams(location.search).get('lang');
    if (supported[param]) lang = param;
  } catch (e) {}
  if (!lang) {
    try {
      var saved = localStorage.getItem('video-converter.lang');
      if (supported[saved]) lang = saved;
    } catch (e) {}
  }
  if (!lang) {
    var preferred = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    lang = /^ja\b/i.test(preferred) ? 'ja' : 'en';
  }
  var root = document.documentElement;
  root.lang = lang;
  if (lang !== 'ja') {
    // The page is written in Japanese; hide it until it has been translated
    // (or after a moment anyway, should the translation never run).
    root.setAttribute('data-i18n-pending', '');
    setTimeout(function () {
      root.removeAttribute('data-i18n-pending');
    }, 3000);
  }
})();
