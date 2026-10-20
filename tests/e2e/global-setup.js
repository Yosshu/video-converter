import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The test videos are generated with a native ffmpeg (see scripts/make-fixtures.sh).
export default function globalSetup() {
  const marker = fileURLToPath(new URL('../fixtures/not-a-video.txt', import.meta.url));
  if (existsSync(marker)) return;
  const script = fileURLToPath(new URL('../../scripts/make-fixtures.sh', import.meta.url));
  execFileSync('bash', [script], { stdio: 'inherit' });
}
