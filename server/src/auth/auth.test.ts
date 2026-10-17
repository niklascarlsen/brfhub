import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {eq, sql} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {CODE_RESEND_SECONDS, CODES_PER_HOUR} from './codeRequests.js';
import {MEMBER_SESSION_DAYS} from './sessions.js';
import {db, pool} from '../db/index.js';
import {codeRequests, session, user} from '../db/schema.js';
import {
  assertTestDatabase,
  codeOf,
  codeSentTo,
  forgetCodeRequests,
  memoryMail,
  memoryPush,
  ORIGIN,
  PASSWORD,
  resetDatabase,
  seedOrganization,
  signIn,
} from '../test/fixtures.js';

const NORTH = {
  id: 'north',
  name: 'Brf Norr',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 30,
  locales: ['sv', 'en'] as ['sv', 'en'],
};

let server: Awaited<ReturnType<typeof buildApp>>;
const mail = memoryMail();

function emailOf(apartment: string) {
  return `${apartment}@north.example.com`;
}

function method(email: string) {
  return server.inject({
    method: 'POST',
    url: '/sign-in/method',
    payload: {email},
  });
}

function askForCode(email: string, remoteAddress?: string) {
  return server.inject({
    method: 'POST',
    url: '/auth/email-otp/send-verification-otp',
    headers: {origin: ORIGIN},
    remoteAddress,
    payload: {email, type: 'sign-in'},
  });
}

// A code as if none had been asked for lately.
async function sendCode(email: string, acceptLanguage?: string) {
  await forgetCodeRequests(email);
  return server.inject({
    method: 'POST',
    url: '/auth/email-otp/send-verification-otp',
    headers: {origin: ORIGIN, 'accept-language': acceptLanguage ?? ''},
    payload: {email, type: 'sign-in'},
  });
}

// Moves the address's codes the given seconds into the past.
async function codesAgo(email: string, seconds: number) {
  const back = sql.raw(`interval '${seconds} seconds'`);
  await db
    .update(codeRequests)
    .set({
      sentAt: sql`${codeRequests.sentAt} - ${back}`,
      hourFrom: sql`${codeRequests.hourFrom} - ${back}`,
    })
    .where(eq(codeRequests.email, email));
}

function waitOf(
  response: Awaited<ReturnType<typeof askForCode>>,
  code = 'CODE_RECENTLY_SENT',
) {
  assert.equal(response.statusCode, 429);
  const body = response.json<{code: string; retryAfter: number}>();
  assert.equal(body.code, code);
  assert.equal(response.headers['retry-after'], String(body.retryAfter));
  return body.retryAfter;
}

before(async () => {
  await assertTestDatabase();
  server = await buildApp({
    logger: false,
    push: memoryPush(),
    mail: mail.send,
  });
  await resetDatabase();
  await seedOrganization({
    organization: NORTH,
    kinds: [],
    resources: [],
    slots: [],
    apartments: ['1', '2'],
    emailOf,
    adminEmail: 'admin@north.example.com',
  });
});

after(async () => {
  await server.close();
  await pool.end();
});

test('tells an apartment to expect a code and an admin a password', async () => {
  const apartment = await method(' 1@North.example.com ');
  assert.equal(apartment.statusCode, 200);
  assert.deepEqual(apartment.json(), {method: 'code'});

  const admin = await method('admin@north.example.com');
  assert.deepEqual(admin.json(), {method: 'password'});
});

test('an unknown address is told the same as an apartment and mailed nothing', async () => {
  const unknown = await method('nobody@north.example.com');
  assert.deepEqual(unknown.json(), {method: 'code'});

  const before = mail.sent.length;
  const sent = await sendCode('nobody@north.example.com');
  assert.equal(sent.statusCode, 200);
  assert.equal(mail.sent.length, before);
});

test('an admin is mailed no code, and a code never signs one in', async () => {
  const before = mail.sent.length;
  const sent = await sendCode('admin@north.example.com');
  assert.equal(sent.statusCode, 200);
  assert.equal(mail.sent.length, before);

  const response = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email-otp',
    headers: {origin: ORIGIN},
    payload: {email: 'admin@north.example.com', otp: '123456'},
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json<{code: string}>().code, 'INVALID_OTP');

  // The password still works: nothing was revoked on the way.
  const {response: signedIn} = await signIn(server, 'admin@north.example.com');
  assert.equal(signedIn.statusCode, 200);
});

test('refuses an address that is not one', async () => {
  const response = await method('not an email');
  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'VALIDATION');
});

test('mails the code in the language the device asks for', async () => {
  await sendCode(emailOf('1'), 'en-GB,en;q=0.9');
  const english = mail.lastTo(emailOf('1'));
  assert.match(english?.subject ?? '', /is your BrfHub code/);
  assert.match(english?.text ?? '', /10 minutes/);

  await sendCode(emailOf('1'), 'sv');
  const swedish = mail.lastTo(emailOf('1'));
  assert.match(swedish?.subject ?? '', /är din kod till BrfHub/);

  // A language the organization does not write in falls back to English
  // when it writes in it, like every other answer to that device.
  await sendCode(emailOf('1'), 'de');
  assert.match(mail.lastTo(emailOf('1'))?.subject ?? '', /is your BrfHub code/);
});

test('a code signs in once and is then spent', async () => {
  const before = mail.sent.length;
  await sendCode(emailOf('2'));
  const code = codeSentTo(emailOf('2'), before);
  assert.ok(code);

  const first = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email-otp',
    headers: {origin: ORIGIN},
    payload: {email: emailOf('2'), otp: code},
  });
  assert.equal(first.statusCode, 200);

  const again = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email-otp',
    headers: {origin: ORIGIN},
    payload: {email: emailOf('2'), otp: code},
  });
  assert.equal(again.statusCode, 400);
});

test('an address is mailed a code at most every half minute, from whatever client', async () => {
  const email = emailOf('2');
  await forgetCodeRequests(email);
  const before = mail.sent.length;

  assert.equal((await askForCode(email, '198.51.100.1')).statusCode, 200);
  const wait = waitOf(await askForCode(email, '198.51.100.2'));
  assert.ok(wait > 0 && wait <= CODE_RESEND_SECONDS);
  assert.equal(mail.sent.length, before + 1);

  // Spelled another way, it is the same address.
  waitOf(await askForCode(email.toUpperCase()));

  await codesAgo(email, CODE_RESEND_SECONDS);
  assert.equal((await askForCode(email)).statusCode, 200);
  assert.equal(mail.sent.length, before + 2);
});

test('an unknown address waits like a known one, and is still mailed nothing', async () => {
  const email = 'nobody@north.example.com';
  await forgetCodeRequests(email);
  const before = mail.sent.length;

  assert.equal((await askForCode(email)).statusCode, 200);
  waitOf(await askForCode(email));
  assert.equal(mail.sent.length, before);
});

test('a client is mailed only so many codes an hour for an address, and others still are', async () => {
  const email = emailOf('1');
  const asking = '198.51.100.7';
  await forgetCodeRequests(email);

  for (let i = 0; i < CODES_PER_HOUR; i++) {
    assert.equal((await askForCode(email, asking)).statusCode, 200);
    await codesAgo(email, CODE_RESEND_SECONDS);
  }

  // Waits for the hour that began with its first, half a minute per code
  // ago.
  const hour = 60 * 60;
  const wait = waitOf(await askForCode(email, asking), 'TOO_MANY_CODES');
  const elapsed = CODES_PER_HOUR * CODE_RESEND_SECONDS;
  assert.ok(wait > hour - elapsed - 5 && wait <= hour - elapsed);

  // The resident, asking from elsewhere, is not held up by it.
  assert.equal((await askForCode(email, '203.0.113.9')).statusCode, 200);

  await codesAgo(email, wait);
  assert.equal((await askForCode(email, asking)).statusCode, 200);
});

test('asked again while it holds, the same code is mailed and still signs in', async () => {
  const email = emailOf('2');
  await forgetCodeRequests(email);
  const before = mail.sent.length;

  await askForCode(email, '198.51.100.1');
  const first = codeSentTo(email, before);
  await codesAgo(email, CODE_RESEND_SECONDS);
  await askForCode(email, '198.51.100.2');
  assert.equal(mail.sent.length, before + 2);
  assert.equal(codeSentTo(email, before + 1), first);

  const response = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email-otp',
    headers: {origin: ORIGIN},
    payload: {email, otp: first},
  });
  assert.equal(response.statusCode, 200);
});

test('a code spent signing in leaves nothing to wait on', async () => {
  const email = emailOf('2');
  await forgetCodeRequests(email);
  const before = mail.sent.length;

  await askForCode(email);
  const signedIn = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email-otp',
    headers: {origin: ORIGIN},
    payload: {email, otp: codeSentTo(email, before)},
  });
  assert.equal(signedIn.statusCode, 200);

  // Signed out on the spot and in again: a new code goes at once.
  assert.equal((await askForCode(email)).statusCode, 200);
  assert.equal(mail.sent.length, before + 2);
});

test('a code whose mail failed, or that was refused, is not counted', async () => {
  const email = emailOf('2');
  await forgetCodeRequests(email);

  // Better Auth answers as if it went: the failure is only logged.
  mail.refuse([email]);
  try {
    assert.equal((await askForCode(email)).statusCode, 200);
  } finally {
    mail.refuse([]);
  }
  assert.equal((await askForCode(email)).statusCode, 200);

  await forgetCodeRequests(email);
  const refused = await server.inject({
    method: 'POST',
    url: '/auth/email-otp/send-verification-otp',
    headers: {origin: ORIGIN},
    payload: {email, type: 'not-a-type'},
  });
  assert.equal(refused.statusCode, 400);
  assert.equal((await askForCode(email)).statusCode, 200);
});

test('the code to set a password waits the same', async () => {
  const email = 'admin@north.example.com';
  await forgetCodeRequests(email);
  const reset = () =>
    server.inject({
      method: 'POST',
      url: '/auth/email-otp/request-password-reset',
      headers: {origin: ORIGIN},
      payload: {email},
    });

  assert.equal((await reset()).statusCode, 200);
  waitOf(await reset());
  // Better Auth's older name for the route counts with it.
  waitOf(
    await server.inject({
      method: 'POST',
      url: '/auth/forget-password/email-otp',
      headers: {origin: ORIGIN},
      payload: {email},
    }),
  );
});

test("an admin's session ends a week after sign-in however much it is used, alone", async () => {
  const {cookie} = await signIn(server, 'admin@north.example.com');
  const [admin] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, 'admin@north.example.com'));

  const fresh = await server.inject({
    method: 'GET',
    url: '/account',
    headers: {cookie},
  });
  assert.equal(fresh.statusCode, 200);

  await db
    .update(session)
    .set({createdAt: sql`now() - interval '8 days'`})
    .where(eq(session.userId, admin?.id ?? ''));
  // Another device signed in later and keeps its own session.
  const phone = await signIn(server, 'admin@north.example.com');
  const sessionsOf = () =>
    db
      .select({id: session.id})
      .from(session)
      .where(eq(session.userId, admin?.id ?? ''));
  const before = (await sessionsOf()).length;

  const stale = await server.inject({
    method: 'GET',
    url: '/account',
    headers: {cookie},
  });
  assert.equal(stale.statusCode, 401);

  assert.equal((await sessionsOf()).length, before - 1);
  const stillIn = await server.inject({
    method: 'GET',
    url: '/account',
    headers: {cookie: phone.cookie},
  });
  assert.equal(stillIn.statusCode, 200);
});

test("Better Auth's own routes end a stale admin session too", async () => {
  const {cookie} = await signIn(server, 'admin@north.example.com');
  const [admin] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, 'admin@north.example.com'));
  const sessionsOf = () =>
    db
      .select({id: session.id})
      .from(session)
      .where(eq(session.userId, admin?.id ?? ''));

  // The password can be changed while the session is fresh.
  const fresh = await server.inject({
    method: 'POST',
    url: '/auth/change-password',
    headers: {origin: ORIGIN, cookie},
    payload: {currentPassword: PASSWORD, newPassword: PASSWORD},
  });
  assert.equal(fresh.statusCode, 200, fresh.body);

  await db
    .update(session)
    .set({createdAt: sql`now() - interval '8 days'`})
    .where(eq(session.userId, admin?.id ?? ''));
  const before = (await sessionsOf()).length;

  const stale = await server.inject({
    method: 'POST',
    url: '/auth/change-password',
    headers: {origin: ORIGIN, cookie},
    payload: {currentPassword: PASSWORD, newPassword: PASSWORD},
  });
  assert.equal(stale.statusCode, 401);
  assert.equal((await sessionsOf()).length, before - 1);

  // Asking who is signed in finds nobody, so the client shows the login.
  const nobody = await server.inject({
    method: 'GET',
    url: '/auth/get-session',
    headers: {origin: ORIGIN, cookie},
  });
  assert.equal(nobody.statusCode, 200);
  assert.equal(nobody.body, 'null');
});

test('asking who is signed in on a stale admin session finds nobody', async () => {
  const {cookie} = await signIn(server, 'admin@north.example.com');
  const [admin] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, 'admin@north.example.com'));
  await db
    .update(session)
    .set({createdAt: sql`now() - interval '8 days'`})
    .where(eq(session.userId, admin?.id ?? ''));

  const nobody = await server.inject({
    method: 'GET',
    url: '/auth/get-session',
    headers: {origin: ORIGIN, cookie},
  });
  assert.equal(nobody.statusCode, 200);
  assert.equal(nobody.body, 'null');
  assert.equal(
    (await server.inject({method: 'GET', url: '/account', headers: {cookie}}))
      .statusCode,
    401,
  );
});

test("a used session is extended, and the device's cookie with it", async () => {
  const {cookie} = await signIn(server, emailOf('2'));
  const [resident] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, emailOf('2')));

  // Last extended two days ago, past Better Auth's updateAge of a day:
  // the end lies two days short of a full term from now.
  await db
    .update(session)
    .set({
      expiresAt: sql`now() + make_interval(days => ${MEMBER_SESSION_DAYS - 2})`,
    })
    .where(eq(session.userId, resident?.id ?? ''));

  const response = await server.inject({
    method: 'GET',
    url: '/auth/get-session',
    headers: {origin: ORIGIN, cookie},
  });
  assert.equal(response.statusCode, 200);
  assert.ok(
    (response.headers['set-cookie'] as string[] | undefined)?.some((entry) =>
      entry.includes('session_token='),
    ),
    'the renewed cookie',
  );
});

test("an apartment's session is not cut short", async () => {
  const {cookie} = await signIn(server, emailOf('1'));
  const [resident] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, emailOf('1')));

  await db
    .update(session)
    .set({createdAt: sql`now() - interval '60 days'`})
    .where(eq(session.userId, resident?.id ?? ''));

  const response = await server.inject({
    method: 'GET',
    url: '/account',
    headers: {cookie},
  });
  assert.equal(response.statusCode, 200);
});
