import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {format, resolveConfig} from 'prettier';

import {buildApp} from '../src/app.js';
import {PASSWORD_LENGTH} from '../src/auth/auth.js';
import {CODE_RESEND_SECONDS} from '../src/auth/codeRequests.js';
import {pool} from '../src/db/index.js';
import {expoAndWebPush} from '../src/lib/push.js';
import {limitsModule, limitsOf} from './limits.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Written the way core's Prettier would, so a formatter run over the
// generated files changes nothing and types:check stays clean.
async function formatted(path: string, source: string): Promise<string> {
  const options = await resolveConfig(path, {editorconfig: true});

  return format(source, {...options, filepath: path});
}
// Only reads the routes, so it never sends push or mail.
const app = await buildApp({push: expoAndWebPush, mail: async () => {}});

try {
  await app.ready();

  const document = app.swagger();
  const openapiPath = resolve(root, 'openapi.json');
  writeFileSync(openapiPath, `${JSON.stringify(document, null, 2)}\n`);

  const outPath = resolve(root, '../core/src/generated/api.d.ts');
  mkdirSync(dirname(outPath), {recursive: true});

  // Better Auth changes the password outside openapi.json, so its rule is
  // added as the body it would have, and how soon a code mailed through it
  // may be asked for again, which the login screen counts down.
  const limitsPath = resolve(dirname(outPath), 'limits.ts');
  writeFileSync(
    limitsPath,
    await formatted(
      limitsPath,
      limitsModule({
        ...limitsOf(document),
        ChangePasswordBody: {
          newPassword: {
            minLength: PASSWORD_LENGTH.min,
            maxLength: PASSWORD_LENGTH.max,
          },
        },
        MailedCode: {resendSeconds: CODE_RESEND_SECONDS},
      }),
    ),
  );

  execFileSync('npx', ['openapi-typescript', openapiPath, '-o', outPath], {
    cwd: root,
    stdio: 'inherit',
  });
  writeFileSync(
    outPath,
    await formatted(outPath, readFileSync(outPath, 'utf8')),
  );
} finally {
  await app.close();
  await pool.end();
}
