import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildApp} from '../src/app.js';
import {pool} from '../src/db/index.js';
import {sendPush} from '../src/lib/push.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = await buildApp({push: sendPush});

try {
  await app.ready();

  const openapiPath = resolve(root, 'openapi.json');
  writeFileSync(openapiPath, `${JSON.stringify(app.swagger(), null, 2)}\n`);

  const outPath = resolve(root, '../core/src/generated/api.d.ts');
  mkdirSync(dirname(outPath), {recursive: true});

  execFileSync('npx', ['openapi-typescript', openapiPath, '-o', outPath], {
    cwd: root,
    stdio: 'inherit',
  });
} finally {
  await app.close();
  await pool.end();
}
