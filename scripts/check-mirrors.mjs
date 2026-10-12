// Files that read the same in app/src and web/src but bind each client's
// own platform code through @/, so they cannot move into core. Fails with a
// diff when one copy has changed without the other.
import {spawnSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const MIRRORS = [
  'admin/account.ts',
  'auth/account.tsx',
  'auth/session.tsx',
  'config.tsx',
  'hooks/useBookingActions.ts',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

for (const file of MIRRORS) {
  const result = spawnSync(
    'diff',
    ['-u', join('app/src', file), join('web/src', file)],
    {cwd: root, encoding: 'utf8'},
  );

  if (result.status !== 0) {
    failed = true;
    console.error(`${file} differs between app/src and web/src:`);
    console.error(result.stdout || result.stderr);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`${MIRRORS.length} mirrored files match.`);
