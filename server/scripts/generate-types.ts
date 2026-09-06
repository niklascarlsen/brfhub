import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildApp} from '../src/app.js';
import {pool} from '../src/db/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = await buildApp();

try {
  await app.ready();

  const openapiPath = resolve(root, 'openapi.json');
  writeFileSync(openapiPath, `${JSON.stringify(app.swagger(), null, 2)}\n`);

  const outPaths = [
    resolve(root, '../app/src/generated/api.d.ts'),
    resolve(root, '../web/src/generated/api.d.ts'),
  ];

  for (const outPath of outPaths) {
    mkdirSync(dirname(outPath), {recursive: true});

    execFileSync('npx', ['openapi-typescript', openapiPath, '-o', outPath], {
      cwd: root,
      stdio: 'inherit',
    });
  }
} finally {
  await app.close();
  await pool.end();
}
