import 'dotenv/config';

import {eq} from 'drizzle-orm';

import {resetTwoFactor} from '../src/auth/auth.service.js';
import {db, pool} from '../src/db/index.js';
import {user} from '../src/db/schema.js';

const USAGE = `Usage: npm run admin:reset-2fa -- <email>

Forgets the admin's authenticator and ends every session, so they set a
new one up at the next sign-in. For the last admin of an organization,
whom no colleague can do it for.`;

const email = process.argv[2]?.toLowerCase();

if (!email) {
  console.error(USAGE);
  process.exit(1);
}

try {
  const [account] = await db
    .select({id: user.id, admin: user.admin})
    .from(user)
    .where(eq(user.email, email));

  if (!account?.admin) {
    throw new Error(`${email} is not an admin`);
  }

  await resetTwoFactor(account.id);
  console.log(`${email} sets up a new authenticator at the next sign-in.`);
} finally {
  await pool.end();
}
