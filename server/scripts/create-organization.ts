import 'dotenv/config';

import {parseArgs} from 'node:util';

import {eq} from 'drizzle-orm';

import {createUser} from '../src/auth/auth.service.js';
import {db, pool} from '../src/db/index.js';
import {organizations, user} from '../src/db/schema.js';
import {generatePassword} from '../src/lib/password.js';

const USAGE = `Usage: npm run org:create -- --id <slug> --name <name> --admin-email <email> [--window <days>]

Creates an organization and its admin account, and prints the admin's
password once.`;

const DEFAULT_WINDOW_DAYS = 30;

const {values} = parseArgs({
  options: {
    id: {type: 'string'},
    name: {type: 'string'},
    'admin-email': {type: 'string'},
    window: {type: 'string'},
  },
});

const id = values.id;
const name = values.name;
const adminEmail = values['admin-email'];
const bookingWindowDays = Number(values.window ?? DEFAULT_WINDOW_DAYS);

if (
  !id ||
  !/^[a-z0-9-]+$/.test(id) ||
  !name ||
  !adminEmail ||
  !Number.isInteger(bookingWindowDays) ||
  bookingWindowDays < 1
) {
  console.error(USAGE);
  process.exit(1);
}

try {
  const [existing] = await db
    .select({id: organizations.id})
    .from(organizations)
    .where(eq(organizations.id, id));

  if (existing) {
    throw new Error(`Organization ${id} already exists`);
  }

  const [taken] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, adminEmail));

  if (taken) {
    throw new Error(`${adminEmail} already has an account`);
  }

  const password = generatePassword();

  // One transaction, so a failure leaves neither the organization nor a
  // half-made admin behind.
  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({id, name, bookingWindowDays});
    await createUser(
      {
        email: adminEmail,
        password,
        name: `Admin ${name}`,
        organizationId: id,
        role: 'admin',
      },
      tx,
    );
  });

  console.log(`Created ${name} (${id})`);
  console.log(`Admin: ${adminEmail}`);
  console.log(`Password: ${password}`);
  console.log('The password is shown only now.');
} finally {
  await pool.end();
}
