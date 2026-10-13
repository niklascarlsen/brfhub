import 'dotenv/config';

import {eq} from 'drizzle-orm';

import {totpCode, twoFactorSecret} from '../src/auth/auth.service.js';
import {db, pool} from '../src/db/index.js';
import {user} from '../src/db/schema.js';

const USAGE = `Usage: npm run totp -- <email>

Prints what the admin's authenticator app shows right now, for signing in
to a development database without one.`;

const email = process.argv[2]?.toLowerCase();

if (!email) {
  console.error(USAGE);
  process.exit(1);
}

try {
  const [account] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, email));

  if (!account) {
    throw new Error(`No account for ${email}`);
  }

  const secret = await twoFactorSecret(account.id);

  if (secret === null) {
    throw new Error(`${email} has no authenticator set up`);
  }

  console.log(await totpCode(secret));
} finally {
  await pool.end();
}
