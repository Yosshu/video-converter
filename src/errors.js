// Error codes, the messages shown for them (Japanese and English), and the
// rules that map ffmpeg's output to a code. No DOM access, so it can be
// unit-tested in Node.

export class AppError extends Error {
  /**
   * @param {keyof typeof MESSAGES} code
   * @param {{ cause?: unknown, detail?: Record<string, string> }} [options]
   */
  constructor(code, { cause, detail } = {}) {
    super(code, { cause });
    this.name = 'AppError';
    this.code = code;
    this.detail = detail ?? {};
  }
}

/**
 * Per language — title: what happened; cause: why; fixes: what to do about it.
 * `{name}` in a message is filled in from AppError#detail.
 * kind "info" is shown as a notice rather than as an error.
 */
export const MESSAGES = {
  NO_FILE: {
    ja: {
      title: '動画が選択されていません',
      cause: '変換する動画がまだ選ばれていません。',
      fixes: ['「動画を選ぶ」ボタンを押すか、動画をこの画面にドラッグ＆ドロップしてください。'],
    },
    en: {
      title: 'No video selected',
      cause: 'You have not chosen a video to convert yet.',
      fixes: ['Press "Choose a video", or drag and drop a video onto this page.'],
    },
  },
  NOT_VIDEO: {
    ja: {
      title: '動画ファイルではないようです',
      cause: '選ばれたファイル（{name}）は動画として扱えません。',
      fixes: [
        'MP4・MOV・M4V などの動画ファイルを選んでください。',
        'iPhone では、ファイル選択の画面で「写真ライブラリ」を選ぶと、画面収録した動画を選べます。',
      ],
    },
    en: {
      title: 'This does not look like a video',
      cause: 'The selected file ({name}) cannot be used as a video.',
      fixes: [
        'Choose a video file such as MP4, MOV or M4V.',
        'On iPhone, choose "Photo Library" in the file picker to find your screen recordings.',
      ],
    },
  },
  EMPTY_FILE: {
    ja: {
      title: 'ファイルが空です',
      cause: '選ばれたファイル（{name}）の大きさが 0 バイトです。コピーや転送が途中で失敗した可能性があります。',
      fixes: ['元の動画をもう一度コピー（転送）してから選び直してください。'],
    },
    en: {
      title: 'The file is empty',
      cause: 'The selected file ({name}) is 0 bytes. Copying or transferring it may have failed partway.',
      fixes: ['Copy (transfer) the original video again, then choose it again.'],
    },
  },
  TOO_LARGE: {
    ja: {
      title: 'ファイルが大きすぎます',
      cause: 'このツールで変換できるのは {limit} までです（選ばれた動画: {size}）。',
      fixes: [
        'iPhone の「写真」アプリで動画を開き、「編集」で前後の不要な部分を切り取ってから選び直してください。',
        '長い録画は、いくつかに分けて録画・保存すると変換しやすくなります。',
      ],
    },
    en: {
      title: 'The file is too large',
      cause: 'This tool can convert files up to {limit} (selected video: {size}).',
      fixes: [
        'Open the video in the iPhone Photos app, trim the parts you do not need with "Edit", then choose it again.',
        'Long recordings are easier to convert when recorded and saved in several parts.',
      ],
    },
  },
  UNREADABLE: {
    ja: {
      title: 'この動画を読み込めませんでした',
      cause: '対応していない形式か、ファイルが壊れている（途中までしか保存・転送されていない）可能性があります。',
      fixes: [
        'iPhone から動画をもう一度送り直す（AirDrop・ケーブル・クラウドなど）か、書き出し直してから選んでください。',
        '別のアプリで再生できるか確認してください。再生できない場合はファイルが壊れています。',
        'MP4・MOV・M4V 形式の動画をお試しください。',
      ],
    },
    en: {
      title: 'This video could not be read',
      cause: 'The format may not be supported, or the file may be damaged (only partly saved or transferred).',
      fixes: [
        'Send the video from your iPhone again (AirDrop, cable, cloud storage…) or export it again, then choose it.',
        'Check whether another app can play it. If none can, the file is damaged.',
        'Try a video in MP4, MOV or M4V format.',
      ],
    },
  },
  NO_VIDEO_STREAM: {
    ja: {
      title: '映像が見つかりませんでした',
      cause: 'このファイルには映像が含まれていないようです（音声だけのファイルなど）。',
      fixes: ['映像が入った動画ファイルを選んでください。'],
    },
    en: {
      title: 'No video found',
      cause: 'This file does not seem to contain any video (it may be audio only).',
      fixes: ['Choose a file that contains video.'],
    },
  },
  UNSUPPORTED_BROWSER: {
    ja: {
      title: 'このブラウザでは変換できません',
      cause: '変換に必要な機能（WebAssembly・Web Worker）が、このブラウザでは使えません。',
      fixes: [
        '最新版の Chrome・Edge・Safari・Firefox で開き直してください。',
        'iPhone の場合は iOS を最新にして Safari でお試しください。',
      ],
    },
    en: {
      title: 'This browser cannot convert videos',
      cause: 'This browser does not support what the conversion needs (WebAssembly and Web Workers).',
      fixes: [
        'Open this page in an up-to-date Chrome, Edge, Safari or Firefox.',
        'On iPhone, update iOS and try Safari.',
      ],
    },
  },
  LOAD_FAILED: {
    retry: true,
    ja: {
      title: '変換プログラム（FFmpeg）を読み込めませんでした',
      cause: '通信が途中で切れたか、ブラウザの設定や拡張機能で読み込みが止められた可能性があります。',
      fixes: [
        'インターネット接続を確認して「もう一度試す」を押してください。',
        '直らない場合はページを再読み込みしてください。',
        '広告ブロックなどの拡張機能を使っている場合は、このページでは止めてお試しください。',
      ],
    },
    en: {
      title: 'The converter (FFmpeg) could not be loaded',
      cause: 'The connection may have dropped, or a browser setting or extension may have blocked it.',
      fixes: [
        'Check your internet connection and press "Try again".',
        'If that does not help, reload the page.',
        'If you use an ad blocker or similar extension, turn it off for this page and try again.',
      ],
    },
  },
  OUT_OF_MEMORY: {
    ja: {
      title: 'メモリが足りませんでした',
      cause: '動画が大きい・長いため、このブラウザで使えるメモリを超えてしまいました。',
      fixes: [
        'ほかのタブやアプリを閉じてから、もう一度お試しください。',
        '「詳細設定」で「解像度」を小さくすると、使うメモリが減ります。',
        '動画を短く切ってから変換してください。',
        'スマートフォンで失敗する場合は、パソコンで変換するのがおすすめです。',
      ],
    },
    en: {
      title: 'Not enough memory',
      cause: 'The video is too large or too long for the memory this browser can use.',
      fixes: [
        'Close other tabs and apps, then try again.',
        'Choose a smaller "Resolution" under "Advanced settings" to use less memory.',
        'Trim the video to make it shorter, then convert it.',
        'If it fails on a phone, try converting on a computer.',
      ],
    },
  },
  AUDIO_UNSUPPORTED: {
    ja: {
      title: '音声を変換できませんでした',
      cause: 'この動画の音声は、対応していない形式です（{codec}）。',
      fixes: ['「詳細設定」の「音声」を「消す」にすると、映像だけを変換できます。'],
    },
    en: {
      title: 'The audio could not be converted',
      cause: 'The audio in this video is in a format that is not supported ({codec}).',
      fixes: ['Set "Audio" to "Remove" under "Advanced settings" to convert the video without its audio.'],
    },
  },
  CONVERT_FAILED: {
    ja: {
      title: '変換中にエラーが発生しました',
      cause: '動画の一部が壊れているか、対応していない形式が含まれている可能性があります。',
      fixes: [
        'もう一度「変換開始」を押してください。',
        '「詳細設定」で設定を変えると変換できることがあります。',
        '直らない場合は、下の「詳細ログ」に原因が表示されていることがあります。',
      ],
    },
    en: {
      title: 'Something went wrong while converting',
      cause: 'Part of the video may be damaged, or it may contain a format that is not supported.',
      fixes: [
        'Press "Start converting" again.',
        'Changing the settings under "Advanced settings" sometimes helps.',
        'If it keeps failing, the "Detailed log" below may show the cause.',
      ],
    },
  },
  DOWNLOAD_FAILED: {
    ja: {
      title: 'ダウンロードできませんでした',
      cause: 'ブラウザがファイルの保存を止めたか、メモリが足りなかった可能性があります。',
      fixes: [
        'もう一度「ダウンロード」を押してください。',
        'プレビューの動画を右クリック（スマートフォンでは長押し）して保存することもできます。',
        'ブラウザの設定で、このページからのダウンロードが許可されているか確認してください。',
      ],
    },
    en: {
      title: 'The download failed',
      cause: 'The browser may have blocked saving the file, or run out of memory.',
      fixes: [
        'Press "Download" again.',
        'You can also right-click the preview (long-press on phones and tablets) and save it from there.',
        'Check that your browser settings allow downloads from this page.',
      ],
    },
  },
  SHARE_FAILED: {
    ja: {
      title: '共有できませんでした',
      cause: 'ブラウザが共有を受け付けませんでした。',
      fixes: ['「ダウンロード」ボタンから保存してください。'],
    },
    en: {
      title: 'Sharing failed',
      cause: 'The browser did not accept the file for sharing.',
      fixes: ['Save it with the "Download" button instead.'],
    },
  },
  CANCELED: {
    kind: 'info',
    ja: {
      title: '変換をキャンセルしました',
      cause: '変換を途中で止めました。作りかけのデータは削除しました。',
      fixes: ['もう一度「変換開始」を押すと、最初から変換し直します。'],
    },
    en: {
      title: 'Conversion cancelled',
      cause: 'The conversion was stopped, and the partly converted data was deleted.',
      fixes: ['Press "Start converting" to convert again from the beginning.'],
    },
  },
};

/** The message for an error in the given language, with placeholders filled in. */
export function describeError(error, lang = 'ja') {
  const code = error instanceof AppError ? error.code : 'CONVERT_FAILED';
  const entry = MESSAGES[code] ?? MESSAGES.CONVERT_FAILED;
  const text = entry[lang] ?? entry.ja;
  const detail = error instanceof AppError ? error.detail : {};
  const unknown = lang === 'en' ? 'unknown' : '不明';
  const fill = (value) => value.replace(/\{(\w+)\}/g, (_, key) => detail[key] ?? unknown);
  return {
    code,
    kind: entry.kind ?? 'error',
    title: fill(text.title),
    cause: fill(text.cause),
    fixes: text.fixes.map(fill),
    retry: Boolean(entry.retry),
  };
}

const OUT_OF_MEMORY =
  /Cannot allocate memory|out of memory|\bOOM\b|Array buffer allocation failed|allocation failed|Cannot enlarge memory|memory access out of bounds/i;
const UNREADABLE =
  /Invalid data found when processing input|moov atom not found|could not find codec parameters|Error opening input|End of file|error reading header|Invalid NAL unit|Unknown format/i;
const MISSING_DECODER = /(?:Decoder \(codec ([\w-]+)\) not found|Failed to open codec|Error while opening decoder) for input stream #0:(\d+)/i;

/**
 * Picks an error code for a failed ffmpeg run from its log (and the exception,
 * if the run threw instead of exiting with an error).
 *
 * @param {string[]} logLines recent ffmpeg log lines
 * @param {{ error?: unknown, info?: ReturnType<import('./media-info.js').parseProbe> }} [context]
 * @returns {AppError}
 */
export function classifyFailure(logLines, { error, info } = {}) {
  const text = [...logLines, error ? String(error?.message ?? error) : ''].join('\n');
  if (error instanceof RangeError || OUT_OF_MEMORY.test(text)) {
    return new AppError('OUT_OF_MEMORY', { cause: error });
  }
  const decoder = MISSING_DECODER.exec(text);
  if (decoder && info) {
    const stream = info.streams.find((s) => s.index === Number(decoder[2]));
    if (stream?.type === 'audio') {
      return new AppError('AUDIO_UNSUPPORTED', { cause: error, detail: { codec: stream.codec || decoder[1] } });
    }
  }
  if (decoder || UNREADABLE.test(text)) return new AppError('UNREADABLE', { cause: error });
  return new AppError('CONVERT_FAILED', { cause: error });
}
