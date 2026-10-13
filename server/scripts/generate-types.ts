import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildApp} from '../src/app.js';
import {PASSWORD_LENGTH} from '../src/auth/auth.js';
import {pool} from '../src/db/index.js';
import {limitsModule, limitsOf} from './limits.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Only reads the routes, so it never sends push.
const app = await buildApp({push: async () => []});

try {
  await app.ready();

  const document = app.swagger();
  const openapiPath = resolve(root, 'openapi.json');
  writeFileSync(openapiPath, `${JSON.stringify(document, null, 2)}\n`);

  const outPath = resolve(root, '../core/src/generated/api.d.ts');
  mkdirSync(dirname(outPath), {recursive: true});

  // Better Auth changes the password outside openapi.json, so its rule is
  // added as the body it would have.
  writeFileSync(
    resolve(dirname(outPath), 'limits.ts'),
    limitsModule({
      ...limitsOf(document),
      ChangePasswordBody: {
        newPassword: {
          minLength: PASSWORD_LENGTH.min,
          maxLength: PASSWORD_LENGTH.max,
        },
      },
    }),
  );

  execFileSync('npx', ['openapi-typescript', openapiPath, '-o', outPath], {
    cwd: root,
    stdio: 'inherit',
  });
} finally {
  await app.close();
  await pool.end();
}
