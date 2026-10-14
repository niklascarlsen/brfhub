import 'dotenv/config';

import {and, asc, eq, isNull, ne, not} from 'drizzle-orm';

import {db, pool} from '../src/db/index.js';
import {
  bookings,
  members,
  organizations,
  pushTokens,
  resources,
  user,
} from '../src/db/schema.js';
import {localize} from '../src/lib/locale.js';
import {slotHasStarted} from '../src/lib/time.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
// npm run push:test -- [organization] [watching apartment]
const ORGANIZATION_ID = process.argv[2] ?? 'demo';
const WATCHER = process.argv[3] ?? '12';

// The password seed.ts gives every admin.
const ADMIN_PASSWORD = 'password';

const sessions = new Map<string, string>();

async function accountOf(
  apartment: string,
): Promise<{email: string; admin: boolean}> {
  const [row] = await db
    .select({email: user.email, admin: user.admin})
    .from(user)
    .innerJoin(members, eq(members.id, user.memberId))
    .where(
      and(
        eq(members.organizationId, ORGANIZATION_ID),
        eq(members.label, apartment),
      ),
    );

  if (!row) {
    throw new Error(
      `No account for apartment ${apartment} in ${ORGANIZATION_ID}`,
    );
  }

  return row;
}

function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ');
}

async function signIn(apartment: string): Promise<string> {
  const known = sessions.get(apartment);

  if (known) {
    return known;
  }

  // A resident signs in with a mailed code, an admin who lives here with
  // the password and then the authenticator. /dev/codes tells both while
  // the dev server fills codes in. Better Auth refuses a POST without an
  // Origin, which fetch does not set.
  const {email, admin} = await accountOf(apartment);
  const post = (path: string, body: object, cookie?: string) =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: process.env.WEB_ORIGIN ?? API_URL,
        ...(cookie ? {cookie} : {}),
      },
      body: JSON.stringify(body),
    });
  const devCodes = async () => {
    const codes = await fetch(
      `${API_URL}/dev/codes?email=${encodeURIComponent(email)}`,
    );

    if (!codes.ok) {
      throw new Error(
        `no sign-in code for ${apartment}: the dev server must run with DEV_SIGN_IN on`,
      );
    }

    return (await codes.json()) as {mailed: string; totp: string | null};
  };

  let response: Response;
  if (admin) {
    const signedIn = await post('/auth/sign-in/email', {
      email,
      password: ADMIN_PASSWORD,
    });
    const asked =
      signedIn.ok &&
      ((await signedIn.clone().json()) as {twoFactorRedirect?: boolean})
        .twoFactorRedirect === true;

    // An admin without an authenticator is signed in by the password alone.
    if (asked) {
      const {totp} = await devCodes();
      response = await post(
        '/auth/two-factor/verify-totp',
        {code: totp},
        cookieOf(signedIn),
      );
    } else {
      response = signedIn;
    }
  } else {
    await post('/auth/email-otp/send-verification-otp', {
      email,
      type: 'sign-in',
    });
    const {mailed} = await devCodes();
    response = await post('/auth/sign-in/email-otp', {email, otp: mailed});
  }

  if (!response.ok) {
    throw new Error(
      `sign-in as ${apartment} → ${response.status} ${await response.text()}`,
    );
  }

  const cookie = cookieOf(response);
  sessions.set(apartment, cookie);

  return cookie;
}

async function request(
  path: string,
  apartment: string,
  init: RequestInit = {},
): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body === undefined ? {} : {'content-type': 'application/json'}),
      cookie: await signIn(apartment),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${response.status} ${await response.text()}`,
    );
  }
}

function findReleasableBooking() {
  return db
    .select({
      id: bookings.id,
      owner: members.label,
      date: bookings.date,
      start: bookings.start,
      end: bookings.end,
      resourceId: bookings.resourceId,
      resourceName: resources.name,
    })
    .from(bookings)
    .innerJoin(members, eq(members.id, bookings.memberId))
    .innerJoin(resources, eq(resources.id, bookings.resourceId))
    .innerJoin(organizations, eq(organizations.id, bookings.organizationId))
    .where(
      and(
        eq(bookings.organizationId, ORGANIZATION_ID),
        isNull(bookings.releasedAt),
        ne(members.label, WATCHER),
        not(
          slotHasStarted(organizations.timeZone, bookings.date, bookings.start),
        ),
      ),
    )
    .orderBy(asc(bookings.date), asc(bookings.start))
    .limit(1)
    .then((rows) => rows[0]);
}

function countTokens() {
  return db
    .select({token: pushTokens.token})
    .from(pushTokens)
    .innerJoin(members, eq(members.id, pushTokens.memberId))
    .where(
      and(
        eq(members.organizationId, ORGANIZATION_ID),
        eq(members.label, WATCHER),
      ),
    )
    .then((rows) => rows.length);
}

try {
  const booking = await findReleasableBooking();

  if (!booking) {
    console.log('No upcoming booking held by another apartment.');
    console.log('Run npm run db:seed and try again.');
    process.exit(1);
  }

  const {id, owner, date, start, end, resourceId} = booking;
  const resourceName = localize(booking.resourceName, 'en');
  console.log(
    `1. apartment ${owner} holds ${resourceName} ${date} ${start}–${end}`,
  );

  await request('/subscriptions', WATCHER, {
    method: 'POST',
    body: JSON.stringify({date, start, resourceId}),
  });
  console.log(`2. apartment ${WATCHER} is watching it`);

  const tokens = await countTokens();

  await request(`/bookings/${id}`, owner, {method: 'DELETE'});
  console.log(`3. apartment ${owner} released it`);
  console.log('');

  if (tokens === 0) {
    console.log(`No push token for apartment ${WATCHER}.`);
    console.log(
      'Sign in to the app as it with notifications allowed, then run this again.',
    );
  } else {
    console.log(
      `Released for ${tokens} device token(s). The server sends push after answering, so watch the emulator, and the server log if nothing comes.`,
    );
  }
} finally {
  await pool.end();
}
