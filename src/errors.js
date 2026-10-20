// Error codes, the Japanese messages shown for them, and the rules that map
// ffmpeg's output to a code. No DOM access, so it can be unit-tested in Node.

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
 * title: what happened; cause: why; fixes: what to do about it.
 * `{name}` in a message is filled in from AppError#detail.
 * kind "info" is shown as a notice rather than as an error.
 */
export const MESSAGES = {
  NO_FILE: {
    title: '動画が選択されていません',
    cause: '変換する動画がまだ選ばれていません。',
    fixes: ['「動画を選ぶ」ボタンを押すか、動画をこの画面にドラッグ＆ドロップしてください。'],
  },
  NOT_VIDEO: {
    title: '動画ファイルではないようです',
    cause: '選ばれたファイル（{name}）は動画として扱えません。',
    fixes: [
      'MP4・MOV・M4V などの動画ファイルを選んでください。',
      'iPhone では、ファイル選択の画面で「写真ライブラリ」を選ぶと、画面収録した動画を選べます。',
    ],
  },
  EMPTY_FILE: {
    title: 'ファイルが空です',
    cause: '選ばれたファイル（{name}）の大きさが 0 バイトです。コピーや転送が途中で失敗した可能性があります。',
    fixes: ['元の動画をもう一度コピー（転送）してから選び直してください。'],
  },
  TOO_LARGE: {
    title: 'ファイルが大きすぎます',
    cause: 'このツールで変換できるのは {limit} までです（選ばれた動画: {size}）。',
    fixes: [
      'iPhone の「写真」アプリで動画を開き、「編集」で前後の不要な部分を切り取ってから選び直してください。',
      '長い録画は、いくつかに分けて録画・保存すると変換しやすくなります。',
    ],
  },
  UNREADABLE: {
    title: 'この動画を読み込めませんでした',
    cause: '対応していない形式か、ファイルが壊れている（途中までしか保存・転送されていない）可能性があります。',
    fixes: [
      'iPhone から動画をもう一度送り直す（AirDrop・ケーブル・クラウドなど）か、書き出し直してから選んでください。',
      '別のアプリで再生できるか確認してください。再生できない場合はファイルが壊れています。',
      'MP4・MOV・M4V 形式の動画をお試しください。',
    ],
  },
  NO_VIDEO_STREAM: {
    title: '映像が見つかりませんでした',
    cause: 'このファイルには映像が含まれていないようです（音声だけのファイルなど）。',
    fixes: ['映像が入った動画ファイルを選んでください。'],
  },
  UNSUPPORTED_BROWSER: {
    title: 'このブラウザでは変換できません',
    cause: '変換に必要な機能（WebAssembly・Web Worker）が、このブラウザでは使えません。',
    fixes: [
      '最新版の Chrome・Edge・Safari・Firefox で開き直してください。',
      'iPhone の場合は iOS を最新にして Safari でお試しください。',
    ],
  },
  LOAD_FAILED: {
    title: '変換プログラム（FFmpeg）を読み込めませんでした',
    cause: '通信が途中で切れたか、ブラウザの設定や拡張機能で読み込みが止められた可能性があります。',
    fixes: [
      'インターネット接続を確認して「もう一度試す」を押してください。',
      '直らない場合はページを再読み込みしてください。',
      '広告ブロックなどの拡張機能を使っている場合は、このページでは止めてお試しください。',
    ],
    retry: true,
  },
  OUT_OF_MEMORY: {
    title: 'メモリが足りませんでした',
    cause: '動画が大きい・長いため、このブラウザで使えるメモリを超えてしまいました。',
    fixes: [
      'ほかのタブやアプリを閉じてから、もう一度お試しください。',
      '「詳細設定」で「解像度」を小さくすると、使うメモリが減ります。',
      '動画を短く切ってから変換してください。',
      'スマートフォンで失敗する場合は、パソコンで変換するのがおすすめです。',
    ],
  },
  AUDIO_UNSUPPORTED: {
    title: '音声を変換できませんでした',
    cause: 'この動画の音声は、対応していない形式です（{codec}）。',
    fixes: ['「詳細設定」の「音声」を「消す」にすると、映像だけを変換できます。'],
  },
  CONVERT_FAILED: {
    title: '変換中にエラーが発生しました',
    cause: '動画の一部が壊れているか、対応していない形式が含まれている可能性があります。',
    fixes: [
      'もう一度「変換開始」を押してください。',
      '「詳細設定」で設定を変えると変換できることがあります。',
      '直らない場合は、下の「詳細ログ」に原因が表示されていることがあります。',
    ],
  },
  DOWNLOAD_FAILED: {
    title: 'ダウンロードできませんでした',
    cause: 'ブラウザがファイルの保存を止めたか、メモリが足りなかった可能性があります。',
    fixes: [
      'もう一度「ダウンロード」を押してください。',
      'プレビューの動画を右クリック（スマートフォンでは長押し）して保存することもできます。',
      'ブラウザの設定で、このページからのダウンロードが許可されているか確認してください。',
    ],
  },
  SHARE_FAILED: {
    title: '共有できませんでした',
    cause: 'ブラウザが共有を受け付けませんでした。',
    fixes: ['「ダウンロード」ボタンから保存してください。'],
  },
  CANCELED: {
    kind: 'info',
    title: '変換をキャンセルしました',
    cause: '変換を途中で止めました。作りかけのデータは削除しました。',
    fixes: ['もう一度「変換開始」を押すと、最初から変換し直します。'],
  },
};

/** The message for an error, with placeholders filled in. */
export function describeError(error) {
  const code = error instanceof AppError ? error.code : 'CONVERT_FAILED';
  const message = MESSAGES[code] ?? MESSAGES.CONVERT_FAILED;
  const detail = error instanceof AppError ? error.detail : {};
  const fill = (text) => text.replace(/\{(\w+)\}/g, (_, key) => detail[key] ?? '不明');
  return {
    code,
    kind: message.kind ?? 'error',
    title: fill(message.title),
    cause: fill(message.cause),
    fixes: message.fixes.map(fill),
    retry: Boolean(message.retry),
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
