// UI text in Japanese and English. No DOM access, so it can be unit-tested.
//
// `ja` holds only the text that the scripts write: the Japanese of the
// page itself (data-i18n elements) is read from the HTML. `en` holds both.
// `{name}` is filled in from the parameters given to translate().

export const LANGUAGES = ['ja', 'en'];

const ja = {
  'message.cause': '原因：{cause}',
  'message.fixes': '対処方法',
  'message.next': 'このあとは',
  'message.retry': 'もう一度試す',

  'button.convert': '変換開始',
  'button.converting': '変換中…',
  'button.checking': '動画を確認中…',

  'info.checking': '確認中…',
  'info.ready': 'そのまま使えます',
  'info.willConvert': 'H.264 に変換します',
  'info.tracks': '（{count}トラック）',
  'info.none': 'なし',
  'info.hdr':
    'HDR（明るさの幅が広い）動画です。変換後は一般的な色合い（SDR）として保存されるため、色が薄く見えることがあります。',
  'info.h264Unplayable':
    'H.264 ですが、一部の再生環境で再生できない形式（10bit や 4:4:4 など）のため、変換し直します。',
  'list.separator': '、',

  'plan.separator': ' ／ ',
  'plan.copy': '映像：作り直さずに MP4 へ入れ直します（画質そのまま）',
  'plan.convert': '映像：{codec} → H.264 に変換',
  'plan.scaled': '解像度：{size} に縮小',
  'plan.keepSize': '解像度：{size}（そのまま）',
  'plan.fps30': '1秒30コマまで',
  'plan.audioRemove': '音声：消す',
  'plan.audioNone': '音声：なし',
  'plan.audioCopy': '音声：AAC のまま',
  'plan.audioAac': '音声：AAC に変換',

  'status.loading': '変換プログラム（FFmpeg）を準備しています…',
  'status.loadingDetail': '初回は約 31MB をダウンロードします。2 回目以降は短時間で終わります。',
  'status.probing': '動画を確認しています…',
  'status.loadFailed': 'FFmpeg を読み込めませんでした',
  'status.copying': 'MP4 に入れ直しています…',
  'status.converting': 'H.264 に変換しています…',
  'status.convertingDetail': '変換が終わるまで、この画面を開いたままにしてください。',
  'status.done': '変換が完了しました',
  'status.canceled': '変換をキャンセルしました',
  'status.error': 'エラーが発生しました',

  'progress.elapsed': '経過 {time}',
  'progress.remaining': ' ・ 残り 約{time}',
  'progress.took': 'かかった時間 {time}',

  'confirm.cancel': '変換を中止しますか？ここまでの変換内容は失われます。',
  'result.largerHint': '（画質を「小さめ」にすると小さくできます）',
  'result.detailSeparator': '・',
  'log.empty': '（まだありません）',
};

const en = {
  // Written by the scripts (same keys as `ja`).
  'message.cause': 'Cause: {cause}',
  'message.fixes': 'What to do',
  'message.next': 'What next',
  'message.retry': 'Try again',

  'button.convert': 'Start converting',
  'button.converting': 'Converting…',
  'button.checking': 'Checking the video…',

  'info.checking': 'Checking…',
  'info.ready': 'Ready to use',
  'info.willConvert': 'Will be converted to H.264',
  'info.tracks': ' ({count} tracks)',
  'info.none': 'None',
  'info.hdr':
    'This is an HDR video. It is saved with standard (SDR) colors after converting, so the colors may look washed out.',
  'info.h264Unplayable':
    'This is H.264, but in a form some players cannot play (such as 10-bit or 4:4:4), so it will be converted again.',
  'list.separator': ', ',

  'plan.separator': ' / ',
  'plan.copy': 'Video: repackaged as MP4 without re-encoding (same quality)',
  'plan.convert': 'Video: {codec} → H.264',
  'plan.scaled': 'Resolution: scaled down to {size}',
  'plan.keepSize': 'Resolution: {size} (unchanged)',
  'plan.fps30': 'Up to 30 fps',
  'plan.audioRemove': 'Audio: removed',
  'plan.audioNone': 'Audio: none',
  'plan.audioCopy': 'Audio: AAC (kept as is)',
  'plan.audioAac': 'Audio: converted to AAC',

  'status.loading': 'Preparing the converter (FFmpeg)…',
  'status.loadingDetail': 'The first time, about 31 MB is downloaded. After that it is quick.',
  'status.probing': 'Checking the video…',
  'status.loadFailed': 'Could not load FFmpeg',
  'status.copying': 'Repackaging as MP4…',
  'status.converting': 'Converting to H.264…',
  'status.convertingDetail': 'Keep this page open until the conversion finishes.',
  'status.done': 'Conversion complete',
  'status.canceled': 'Conversion cancelled',
  'status.error': 'Something went wrong',

  'progress.elapsed': 'Elapsed {time}',
  'progress.remaining': ' · About {time} left',
  'progress.took': 'Took {time}',

  'confirm.cancel': 'Stop converting? The progress so far will be lost.',
  'result.largerHint': ' (choose "Small" quality for a smaller file)',
  'result.detailSeparator': ' · ',
  'log.empty': '(Nothing yet)',

  // The page itself (data-i18n keys in index.html and licenses.html).
  'meta.title': 'Video Converter',
  'meta.description':
    'Converts iPhone screen recordings to H.264 MP4 that plays on Windows, Ubuntu and Mac. The conversion runs on your own device, and your video is never sent to any server on the internet.',
  'app.title': 'Video Converter',
  'app.lead': 'Converts iPhone screen recordings to H.264 MP4 that plays on Windows, Ubuntu and Mac',

  'select.title': 'Choose a video',
  'select.drop': 'Drag and drop a video here',
  'select.or': 'or',
  'select.button': 'Choose a video',
  'select.formats': 'Formats: MP4, MOV, M4V (iPhone screen recordings, camera videos and more)',
  'select.size': 'File size: up to 2 GB (around 500 MB is a safer guide on phones)',
  'select.one': 'One video at a time',

  'file.title': 'Selected video',
  'fact.name': 'File name',
  'fact.size': 'Size',
  'fact.duration': 'Length',
  'fact.resolution': 'Resolution',
  'fact.video': 'Video format',
  'fact.audio': 'Audio',
  'file.change': 'Choose another video',
  'file.clear': 'Clear selection',

  'settings.title': 'Settings',
  'settings.lead': 'If in doubt, leave these as they are.',
  'tag.recommended': 'Recommended',
  'choice.standard': 'Standard',
  'choice.original': 'Original',
  'h264.legend': 'This video is already H.264',
  'h264.copy': 'Keep the quality, just repackage as MP4',
  'h264.copyDesc': 'The video is not re-encoded, so there is no quality loss and it finishes quickly.',
  'h264.encode': 'Re-encode with the settings below',
  'h264.encodeDesc': 'For a smaller file. Takes longer.',
  'quality.legend': 'Quality',
  'quality.high': 'High',
  'quality.highDesc': 'Even small text stays crisp. Larger file.',
  'quality.standardDesc': 'On-screen text stays readable, and the file stays small.',
  'quality.small': 'Small',
  'quality.smallDesc': 'Makes the file smaller. Small text may blur.',
  'advanced.summary': 'Advanced settings',
  'speed.legend': 'Speed',
  'speed.standardDesc': 'Balances speed and file size.',
  'speed.fast': 'Fast',
  'speed.fastDesc': 'Finishes about 30% sooner, but the file is 2–3 times larger.',
  'size.legend': 'Resolution',
  'size.sourceDesc': 'Keeps the width and height.',
  'size.1920': 'Longest side up to 1920 px',
  'size.1920Desc': 'Only larger videos are scaled down. The aspect ratio is kept.',
  'size.1280': 'Longest side up to 1280 px',
  'size.1280Desc': 'Faster and smaller. Small text becomes harder to read.',
  'fps.legend': 'Smoothness (frame rate)',
  'fps.sourceDesc': 'Keeps the motion as smooth as it is.',
  'fps.30': 'Up to 30 fps',
  'fps.30Desc': 'For 60 fps videos, converting takes about 30% less time (the file is not necessarily smaller).',
  'audio.legend': 'Audio',
  'audio.keep': 'Keep',
  'audio.keepDesc': 'Saved as AAC (kept as is if it already is AAC).',
  'audio.remove': 'Remove',
  'audio.removeDesc': 'Video only. Also handy if you would rather not keep the microphone sound.',

  'convert.title': 'Convert',
  'convert.caution':
    'Closing or reloading this page while converting stops the conversion. On phones and tablets, locking the screen or switching to another app can stop it too.',
  'convert.cancel': 'Cancel',

  'result.title': 'Save',
  'result.noPreview':
    'This browser cannot preview H.264 video. The downloaded video plays in other apps (such as Windows Media Player or VLC).',
  'result.compare': 'File size comparison',
  'result.before': 'Before',
  'result.after': 'After',
  'result.download': 'Download',
  'result.share': 'Share / Save to Photos',
  'result.savedWhere':
    'On a computer it is saved to your Downloads folder; on iPhone, to "Downloads" in the Files app.',
  'result.shareNote': 'To add it to the iPhone Photos app, press "Share / Save to Photos" and choose "Save Video".',
  'result.restart': 'Convert another video',

  'privacy.title': 'Privacy and notes',
  'privacy.notSent': 'The video you choose is never sent to any server on the internet. ',
  'privacy.notSentDetail': 'The conversion runs on your own device.',
  'privacy.traffic':
    'The only network traffic is loading this page and the converter (FFmpeg, about 31 MB) from this site (GitHub Pages). On later visits, the copy saved by your browser may be used.',
  'privacy.noThirdParty':
    'No outside servers, CDNs, analytics or ads are used. The page settings (Content Security Policy) make the browser block any connection to other sites.',
  'privacy.noCollect': 'Nothing analyses or collects your videos, their file names, or their pictures and sound.',
  'privacy.language': 'Only the display language you choose is saved in this browser, for your next visit.',
  'privacy.metadata': 'Metadata such as the recording location is left out of the converted video.',
  'privacy.githubLogs':
    'This site is hosted on GitHub Pages, so, as with any website, GitHub’s servers may keep access logs (such as IP addresses).',
  'large.title': 'About large videos',
  'large.memory':
    'Converting uses your device’s memory. With large or long videos, it may run out of memory and fail, or the browser may reload the page.',
  'large.limits':
    'As a guide: up to 2 GB on a computer and around 500 MB on a phone. If it fails, close other apps and tabs, lower the resolution in "Advanced settings", or trim the video first.',
  'large.speed': 'Speed depends on your device. It can take several times the length of the video.',

  'log.summary': 'Detailed log (for troubleshooting)',
  'log.note': 'This is FFmpeg’s output. It is only shown here and never sent anywhere.',
  'footer.libraries': 'Libraries: ',
  'footer.licenses': 'Licenses and source code',

  // licenses.html
  'lic.title': 'Licenses - Video Converter',
  'lic.heading': 'Licenses and source code',
  'lic.back': '← Back to Video Converter',
  'lic.license': 'License: ',
  'lic.fullText': 'Full text: ',
  'lic.source': 'Source code: ',
  'lic.ffmpegDesc': 'The JavaScript library that runs FFmpeg in the browser (it talks to the Web Worker).',
  'lic.coreDesc':
    'FFmpeg 5.1.4 compiled to WebAssembly; this does the actual conversion (placed unchanged in vendor/ffmpeg-core/).',
  'lic.coreGpl':
    'It is built with GPL features enabled and includes GPL libraries (x264, x265), so as a whole it is distributed under the GNU General Public License version 2 or later (GPL-2.0-or-later).',
  'lic.buildSource': 'Source code and build steps: ',
  'lic.buildNote': ' (the Dockerfile and build/ list where each library comes from and its version)',
  'lic.ffmpegSource': 'FFmpeg source code: ',
  'lic.componentsTitle': 'Main libraries in @ffmpeg/core',
  'lic.componentsNote': 'As listed in the ffmpeg.wasm build scripts.',
  'lic.ffmpeg': 'FFmpeg 5.1.4 — LGPL-2.1-or-later (GPL-2.0-or-later, as it is built with GPL features enabled)',
  'lic.x264': 'x264 (H.264 encoder) — GPL-2.0-or-later',
  'lic.x265': 'x265 3.4 (HEVC encoder) — GPL-2.0-or-later',
  'lic.freetype': 'FreeType 2.10.4 — FreeType License or GPL-2.0',
  'lic.emscripten': 'Emscripten 3.1.40 runtime — MIT or University of Illinois/NCSA',
  'lic.appTitle': 'Source code of this tool',
  'lic.appBefore': 'The source code of the page and the conversion steps (index.html, src/ and more) is published at ',
  'lic.appAfter': '.',
};

export const STRINGS = { ja, en };

/** The text for a key in a language (Japanese if missing); `{name}` is filled from params. */
export function translate(lang, key, params = {}) {
  const text = STRINGS[lang]?.[key] ?? STRINGS.ja[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
