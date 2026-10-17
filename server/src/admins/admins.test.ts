import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {and, eq, sql} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {
  enrollTwoFactor,
  setPassword,
  totpCode,
  twoFactorSecret,
} from '../auth/auth.service.js';
import {db, pool} from '../db/index.js';
import {
  account,
  adminEvents,
  members,
  session,
  twoFactor,
  user,
} from '../db/schema.js';
import type {EventPage} from '../event/event.dto.js';
import {
  assertTestDatabase,
  codeOf,
  codeSentTo,
  cookieFrom,
  memoryMail,
  memoryPush,
  ORIGIN,
  PASSWORD,
  resetDatabase,
  seedOrganization,
  signIn,
  TOTP_SECRET,
} from '../test/fixtures.js';
import type {AdminUser} from './admins.dto.js';

const NORTH = {
  id: 'north',
  name: 'Brf Norr',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 30,
};
const SOUTH = {
  id: 'south',
  name: 'Brf Söder',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 30,
};

let server: Awaited<ReturnType<typeof buildApp>>;
const mail = memoryMail();
let admin: {cookie: string};

function emailOf(apartment: string) {
  return `${apartment}@north.example.com`;
}

function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  headers: {cookie: string},
  payload?: Record<string, unknown>,
) {
  return server.inject({method, url, headers, payload});
}

async function adminsOf(headers: {cookie: string}) {
  return (await call('GET', '/admin/admins', headers)).json<AdminUser[]>();
}

async function userIdOf(email: string) {
  const [row] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, email));
  return row?.id ?? '';
}

async function eventsOf(headers: {cookie: string}) {
  return (await call('GET', '/admin/events', headers)).json<EventPage>().events;
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
  await seedOrganization({
    organization: SOUTH,
    kinds: [],
    resources: [],
    slots: [],
    apartments: [],
    emailOf: (apartment) => `${apartment}@south.example.com`,
    adminEmail: 'admin@south.example.com',
  });
  admin = {cookie: (await signIn(server, 'admin@north.example.com')).cookie};
});

after(async () => {
  await server.close();
  await pool.end();
});

test('lists the admins with who is asking', async () => {
  const admins = await adminsOf(admin);

  assert.deepEqual(
    admins.map(({email, apartment, twoFactorEnabled, self}) => ({
      email,
      apartment,
      twoFactorEnabled,
      self,
    })),
    [
      {
        email: 'admin@north.example.com',
        apartment: null,
        twoFactorEnabled: true,
        self: true,
      },
    ],
  );
});

test('adds an admin, who is invited by mail and sets a password with a code', async () => {
  const response = await call('POST', '/admin/admins', admin, {
    name: 'Kassören',
    email: 'Kassor@North.example.com',
  });
  assert.equal(response.statusCode, 201);
  const added = response.json<AdminUser>();
  assert.equal(added.email, 'kassor@north.example.com');
  assert.equal(added.twoFactorEnabled, false);
  assert.equal(added.self, false);

  await server.notifier.idle();
  const invitation = mail.lastTo('kassor@north.example.com');
  assert.match(invitation?.subject ?? '', /admin för Brf Norr/);
  assert.match(invitation?.text ?? '', /skriv in din e-post/);

  // Without a password yet, the address leads straight to choosing one.
  const method = await server.inject({
    method: 'POST',
    url: '/sign-in/method',
    payload: {email: 'kassor@north.example.com'},
  });
  assert.deepEqual(method.json(), {method: 'set-password'});

  // The password is set with a code from the mail.
  const before = mail.sent.length;
  const asked = await server.inject({
    method: 'POST',
    url: '/auth/email-otp/request-password-reset',
    headers: {origin: ORIGIN},
    payload: {email: 'kassor@north.example.com'},
  });
  assert.equal(asked.statusCode, 200);
  assert.match(
    mail.lastTo('kassor@north.example.com', before)?.subject ?? '',
    /kod för att sätta lösenord/,
  );

  const reset = await server.inject({
    method: 'POST',
    url: '/auth/email-otp/reset-password',
    headers: {origin: ORIGIN},
    payload: {
      email: 'kassor@north.example.com',
      otp: codeSentTo('kassor@north.example.com', before),
      password: 'kassorens-losen',
    },
  });
  assert.equal(reset.statusCode, 200);
  const afterwards = await server.inject({
    method: 'POST',
    url: '/sign-in/method',
    payload: {email: 'kassor@north.example.com'},
  });
  assert.deepEqual(afterwards.json(), {method: 'password'});

  // Signed in, but allowed nothing until an authenticator is set up.
  const signedIn = await signIn(
    server,
    'kassor@north.example.com',
    'kassorens-losen',
  );
  assert.equal(signedIn.response.statusCode, 200);
  const refused = await call('GET', '/admin/admins', signedIn);
  assert.equal(refused.statusCode, 403);
  assert.equal(codeOf(refused), 'TWO_FACTOR_REQUIRED');
  const whoAmI = await call('GET', '/account', signedIn);
  assert.equal(whoAmI.statusCode, 200);

  assert.equal(
    (await eventsOf(admin)).find((event) => event.action === 'admin.add')
      ?.subject,
    'kassor@north.example.com',
  );
});

test('an apartment is mailed no password code, and cannot set one', async () => {
  const before = mail.sent.length;
  const asked = await server.inject({
    method: 'POST',
    url: '/auth/email-otp/request-password-reset',
    headers: {origin: ORIGIN},
    payload: {email: emailOf('1')},
  });
  assert.equal(asked.statusCode, 200);
  assert.equal(mail.sent.length, before);

  const reset = await server.inject({
    method: 'POST',
    url: '/auth/email-otp/reset-password',
    headers: {origin: ORIGIN},
    payload: {email: emailOf('1'), otp: '000000', password: 'whatever-12'},
  });
  assert.equal(reset.statusCode, 400);
  assert.deepEqual(
    await db
      .select({id: account.id})
      .from(account)
      .where(eq(account.userId, await userIdOf(emailOf('1')))),
    [],
  );
});

test('a resident made admin keeps the apartment and signs in with a password once chosen', async () => {
  const signedIn = await signIn(server, emailOf('2'));
  assert.equal(signedIn.response.statusCode, 200);

  const response = await call('POST', '/admin/admins', admin, {
    name: 'Boende i 2',
    email: emailOf('2'),
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json<AdminUser>().apartment, '2');

  // Every phone signed in as the apartment is out: the address signs in
  // again, as an admin, after choosing a password with a mailed code.
  assert.equal(
    (await call('GET', '/account', {cookie: signedIn.cookie})).statusCode,
    401,
  );

  const method = await server.inject({
    method: 'POST',
    url: '/sign-in/method',
    payload: {email: emailOf('2')},
  });
  assert.deepEqual(method.json(), {method: 'set-password'});

  // The code no longer signs the apartment in, nor is one mailed.
  const before = mail.sent.length;
  await server.inject({
    method: 'POST',
    url: '/auth/email-otp/send-verification-otp',
    headers: {origin: ORIGIN},
    payload: {email: emailOf('2'), type: 'sign-in'},
  });
  assert.equal(mail.sent.length, before);
  const byCode = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email-otp',
    headers: {origin: ORIGIN},
    payload: {email: emailOf('2'), otp: '000000'},
  });
  assert.equal(byCode.statusCode, 400);
});

test('refuses a taken address', async () => {
  const other = await call('POST', '/admin/admins', admin, {
    name: 'Fel förening',
    email: 'admin@south.example.com',
  });
  assert.equal(other.statusCode, 409);
  assert.equal(codeOf(other), 'EMAIL_TAKEN');

  const already = await call('POST', '/admin/admins', admin, {
    name: 'Igen',
    email: 'kassor@north.example.com',
  });
  assert.equal(already.statusCode, 409);
  assert.equal(codeOf(already), 'EMAIL_TAKEN');
});

test('an admin cannot remove themselves, and the last admin stays', async () => {
  const self = await call(
    'DELETE',
    `/admin/admins/${await userIdOf('admin@north.example.com')}`,
    admin,
  );
  assert.equal(self.statusCode, 409);
  assert.equal(codeOf(self), 'OWN_ACCOUNT');

  const south = {
    cookie: (await signIn(server, 'admin@south.example.com')).cookie,
  };
  const foreign = await call(
    'DELETE',
    `/admin/admins/${await userIdOf('kassor@north.example.com')}`,
    south,
  );
  assert.equal(foreign.statusCode, 404);
});

test('removing a resident admin leaves the apartment, removing another leaves nothing', async () => {
  const resident = await userIdOf(emailOf('2'));
  const residentSession = await signIn(server, emailOf('2'), PASSWORD);
  assert.equal(residentSession.response.statusCode, 401);

  const removed = await call('DELETE', `/admin/admins/${resident}`, admin);
  assert.equal(removed.statusCode, 204);
  const [kept] = await db
    .select({admin: user.admin, memberId: user.memberId})
    .from(user)
    .where(eq(user.id, resident));
  assert.equal(kept?.admin, false);
  assert.ok(kept?.memberId);
  assert.deepEqual(
    await db.select().from(account).where(eq(account.userId, resident)),
    [],
  );
  assert.equal((await signIn(server, emailOf('2'))).response.statusCode, 200);

  const treasurer = await userIdOf('kassor@north.example.com');
  const gone = await call('DELETE', `/admin/admins/${treasurer}`, admin);
  assert.equal(gone.statusCode, 204);
  assert.deepEqual(
    await db.select({id: user.id}).from(user).where(eq(user.id, treasurer)),
    [],
  );
  assert.deepEqual(
    (await eventsOf(admin))
      .filter((event) => event.action === 'admin.remove')
      .map((event) => event.subject)
      .sort(),
    ['kassor@north.example.com', emailOf('2')].sort(),
  );
});

test('a colleague resets a lost authenticator, which is set up again', async () => {
  const response = await call('POST', '/admin/admins', admin, {
    name: 'Sekreteraren',
    email: 'sekr@north.example.com',
  });
  assert.equal(response.statusCode, 201);
  const id = response.json<AdminUser>().id;
  await setPassword(id, PASSWORD);
  await enrollTwoFactor(id, TOTP_SECRET);
  const theirs = await signIn(server, 'sekr@north.example.com');
  assert.equal((await call('GET', '/admin/admins', theirs)).statusCode, 200);

  const reset = await call(
    'POST',
    `/admin/admins/${id}/reset-two-factor`,
    admin,
  );
  assert.equal(reset.statusCode, 204);
  assert.deepEqual(
    await db.select().from(twoFactor).where(eq(twoFactor.userId, id)),
    [],
  );
  assert.deepEqual(
    await db.select().from(session).where(eq(session.userId, id)),
    [],
  );
  assert.equal((await call('GET', '/admin/admins', theirs)).statusCode, 401);

  // Signs in without a second step, and may only set one up.
  const again = await signIn(server, 'sekr@north.example.com');
  assert.equal(again.response.statusCode, 200);
  assert.equal(
    codeOf(await call('GET', '/admin/admins', again)),
    'TWO_FACTOR_REQUIRED',
  );

  const enabled = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/enable',
    headers: {origin: ORIGIN, cookie: again.cookie},
    payload: {password: PASSWORD},
  });
  assert.equal(enabled.statusCode, 200);
  const {totpURI, backupCodes} = enabled.json<{
    totpURI: string;
    backupCodes: string[];
  }>();
  assert.equal(backupCodes.length, 10);
  assert.match(totpURI, /^otpauth:\/\/totp\/BrfHub:/);
  // What the authenticator app that scanned the QR code would answer.
  const secret = (await twoFactorSecret(id)) ?? '';
  const verified = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/verify-totp',
    headers: {origin: ORIGIN, cookie: again.cookie},
    payload: {code: await totpCode(secret)},
  });
  assert.equal(verified.statusCode, 200);
  // Verifying turns the session over, so the cookie is the new one.
  const enrolled = {cookie: cookieFrom(verified)};
  assert.equal((await call('GET', '/admin/admins', enrolled)).statusCode, 200);
});

test('a reset also forgets the devices trusted to skip the code', async () => {
  const response = await call('POST', '/admin/admins', admin, {
    name: 'Ordföranden',
    email: 'ordf@north.example.com',
  });
  const id = response.json<AdminUser>().id;
  await setPassword(id, PASSWORD);
  await enrollTwoFactor(id, TOTP_SECRET);

  // The lost phone trusted itself for a month.
  const signedIn = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN},
    payload: {email: 'ordf@north.example.com', password: PASSWORD},
  });
  const verified = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/verify-totp',
    headers: {origin: ORIGIN, cookie: cookieFrom(signedIn)},
    payload: {code: await totpCode(TOTP_SECRET), trustDevice: true},
  });
  const trusted = cookieFrom(verified)
    .split('; ')
    .filter((entry) => entry.includes('trust'))
    .join('; ');
  assert.ok(trusted);

  await call('POST', `/admin/admins/${id}/reset-two-factor`, admin);
  await enrollTwoFactor(id, TOTP_SECRET);

  const again = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN, cookie: trusted},
    payload: {email: 'ordf@north.example.com', password: PASSWORD},
  });
  assert.equal(
    again.json<{twoFactorRedirect?: boolean}>().twoFactorRedirect,
    true,
  );
});

test('signing out stops trusting the device', async () => {
  const response = await call('POST', '/admin/admins', admin, {
    name: 'Sekreteraren',
    email: 'sekreterare@north.example.com',
  });
  const id = response.json<AdminUser>().id;
  await setPassword(id, PASSWORD);
  await enrollTwoFactor(id, TOTP_SECRET);

  const signedIn = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN},
    payload: {email: 'sekreterare@north.example.com', password: PASSWORD},
  });
  const verified = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/verify-totp',
    headers: {origin: ORIGIN, cookie: cookieFrom(signedIn)},
    payload: {code: await totpCode(TOTP_SECRET), trustDevice: true},
  });
  const cookies = cookieFrom(verified);
  const trusted = cookies
    .split('; ')
    .filter((entry) => entry.includes('trust'))
    .join('; ');
  assert.ok(trusted);

  const signedOut = await server.inject({
    method: 'POST',
    url: '/auth/sign-out',
    headers: {origin: ORIGIN, cookie: cookies},
  });
  assert.equal(signedOut.statusCode, 200);
  assert.ok(
    (signedOut.headers['set-cookie'] as string[]).some(
      (entry) => entry.includes('trust_device=') && /Max-Age=0/i.test(entry),
    ),
  );

  // A device that kept the cookie anyway is asked for the code.
  const again = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN, cookie: trusted},
    payload: {email: 'sekreterare@north.example.com', password: PASSWORD},
  });
  assert.equal(
    again.json<{twoFactorRedirect?: boolean}>().twoFactorRedirect,
    true,
  );
});

// Signs the admin in with the authenticator's code and trusts the device.
// Answers with every cookie, and the trusted device's alone.
async function signInTrusting(email: string, password = PASSWORD) {
  const signedIn = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN},
    payload: {email, password},
  });
  const verified = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/verify-totp',
    headers: {origin: ORIGIN, cookie: cookieFrom(signedIn)},
    payload: {code: await totpCode(TOTP_SECRET), trustDevice: true},
  });
  const cookies = cookieFrom(verified);
  const trusted = cookies
    .split('; ')
    .filter((entry) => entry.includes('trust'))
    .join('; ');
  assert.ok(trusted);

  return {cookies, trusted};
}

// Whether the trusted device still skips the authenticator's code. Better
// Auth renews the cookie at each such sign-in, so the one to send next
// time comes back with the answer.
async function skipsCode(email: string, trusted: string, password = PASSWORD) {
  const again = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN, cookie: trusted},
    payload: {email, password},
  });
  assert.equal(again.statusCode, 200, again.body);
  const renewed = cookieFrom(again)
    .split('; ')
    .filter((entry) => entry.includes('trust'))
    .join('; ');

  return {
    skipped:
      again.json<{twoFactorRedirect?: boolean}>().twoFactorRedirect !== true,
    trusted: renewed || trusted,
  };
}

test('a password chosen inside the app forgets every trusted device', async () => {
  const email = 'kassor@north.example.com';
  const response = await call('POST', '/admin/admins', admin, {
    name: 'Kassören',
    email,
  });
  const id = response.json<AdminUser>().id;
  await setPassword(id, PASSWORD);
  await enrollTwoFactor(id, TOTP_SECRET);

  const laptop = await signInTrusting(email);
  const phone = await signInTrusting(email);

  // A wrong current password changes nothing, trusted devices included.
  const refused = await server.inject({
    method: 'POST',
    url: '/auth/change-password',
    headers: {origin: ORIGIN, cookie: laptop.cookies},
    payload: {currentPassword: 'fel-losen', newPassword: 'kassorens-losen'},
  });
  assert.equal(refused.statusCode, 400);
  const phoneStill = await skipsCode(email, phone.trusted);
  assert.equal(phoneStill.skipped, true);

  const changed = await server.inject({
    method: 'POST',
    url: '/auth/change-password',
    headers: {origin: ORIGIN, cookie: laptop.cookies},
    payload: {
      currentPassword: PASSWORD,
      newPassword: 'kassorens-losen',
      revokeOtherSessions: true,
    },
  });
  assert.equal(changed.statusCode, 200, changed.body);
  assert.ok(
    (changed.headers['set-cookie'] as string[]).some(
      (entry) => entry.includes('trust_device=') && /Max-Age=0/i.test(entry),
    ),
  );

  // Both devices give the code again, the one that changed it too.
  const phoneAfter = await skipsCode(
    email,
    phoneStill.trusted,
    'kassorens-losen',
  );
  assert.equal(phoneAfter.skipped, false);
  const laptopAfter = await skipsCode(email, laptop.trusted, 'kassorens-losen');
  assert.equal(laptopAfter.skipped, false);
});

test('an admin cannot turn off, read out or recode their own authenticator', async () => {
  for (const path of [
    '/auth/two-factor/disable',
    '/auth/two-factor/get-totp-uri',
    '/auth/two-factor/generate-backup-codes',
  ]) {
    const response = await server.inject({
      method: 'POST',
      url: path,
      headers: {origin: ORIGIN, cookie: admin.cookie},
      payload: {password: PASSWORD},
    });
    assert.equal(response.statusCode, 403, path);
  }

  const account = await call('GET', '/account', admin);
  assert.equal(
    account.json<{admin: {twoFactorEnabled: boolean}}>().admin.twoFactorEnabled,
    true,
  );
});

test('a new password ends every session and forgets every trusted device', async () => {
  const response = await call('POST', '/admin/admins', admin, {
    name: 'Revisorn',
    email: 'revisor@north.example.com',
  });
  assert.equal(response.statusCode, 201, response.body);
  const id = response.json<AdminUser>().id;
  await setPassword(id, PASSWORD);
  await enrollTwoFactor(id, TOTP_SECRET);

  const signedIn = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN},
    payload: {email: 'revisor@north.example.com', password: PASSWORD},
  });
  const verified = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/verify-totp',
    headers: {origin: ORIGIN, cookie: cookieFrom(signedIn)},
    payload: {code: await totpCode(TOTP_SECRET), trustDevice: true},
  });
  const cookie = cookieFrom(verified);
  const trusted = cookie
    .split('; ')
    .filter((entry) => entry.includes('trust'))
    .join('; ');
  assert.ok(trusted);
  assert.equal((await call('GET', '/account', {cookie})).statusCode, 200);

  // The password is reset from another device, with the mailed code.
  const before = mail.sent.length;
  await server.inject({
    method: 'POST',
    url: '/auth/email-otp/request-password-reset',
    headers: {origin: ORIGIN},
    payload: {email: 'revisor@north.example.com'},
  });
  const reset = await server.inject({
    method: 'POST',
    url: '/auth/email-otp/reset-password',
    headers: {origin: ORIGIN},
    payload: {
      email: 'revisor@north.example.com',
      otp: codeSentTo('revisor@north.example.com', before),
      password: 'revisorns-losen',
    },
  });
  assert.equal(reset.statusCode, 200);

  // The old session is gone, and the trusted device is asked for the code.
  assert.equal((await call('GET', '/account', {cookie})).statusCode, 401);
  const again = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN, cookie: trusted},
    payload: {email: 'revisor@north.example.com', password: 'revisorns-losen'},
  });
  assert.equal(again.statusCode, 200);
  assert.equal(
    again.json<{twoFactorRedirect?: boolean}>().twoFactorRedirect,
    true,
  );
});

test('a backup code signs in, once', async () => {
  const [row] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.email, 'admin@north.example.com'));
  const signedIn = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN},
    payload: {email: 'admin@north.example.com', password: PASSWORD},
  });
  assert.equal(
    signedIn.json<{twoFactorRedirect: boolean}>().twoFactorRedirect,
    true,
  );
  const pending = (signedIn.headers['set-cookie'] as string[])
    .map((entry) => entry.split(';')[0])
    .join('; ');

  const codes = JSON.parse(
    await (
      await import('better-auth/crypto')
    ).symmetricDecrypt({
      key: (await (await import('../auth/auth.js')).auth.$context).secretConfig,
      data:
        (
          await db
            .select({backupCodes: twoFactor.backupCodes})
            .from(twoFactor)
            .where(eq(twoFactor.userId, row?.id ?? ''))
        )[0]?.backupCodes ?? '',
    }),
  ) as string[];

  const used = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/verify-backup-code',
    headers: {origin: ORIGIN, cookie: pending},
    payload: {code: codes[0]},
  });
  assert.equal(used.statusCode, 200);

  const reused = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/verify-backup-code',
    headers: {origin: ORIGIN, cookie: pending},
    payload: {code: codes[0]},
  });
  assert.notEqual(reused.statusCode, 200);
});

test('a trusted device skips the code for the next sign-in', async () => {
  const signedIn = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN},
    payload: {email: 'admin@north.example.com', password: PASSWORD},
  });
  const pending = (signedIn.headers['set-cookie'] as string[])
    .map((entry) => entry.split(';')[0])
    .join('; ');
  const verified = await server.inject({
    method: 'POST',
    url: '/auth/two-factor/verify-totp',
    headers: {origin: ORIGIN, cookie: pending},
    payload: {code: await totpCode(TOTP_SECRET), trustDevice: true},
  });
  assert.equal(verified.statusCode, 200);
  const trusted = (verified.headers['set-cookie'] as string[])
    .map((entry) => entry.split(';')[0])
    .filter((entry) => entry?.includes('trust'))
    .join('; ');
  assert.ok(trusted);

  const again = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN, cookie: trusted},
    payload: {email: 'admin@north.example.com', password: PASSWORD},
  });
  assert.equal(again.statusCode, 200);
  assert.equal(
    again.json<{twoFactorRedirect?: boolean}>().twoFactorRedirect,
    undefined,
  );
  const cookie = (again.headers['set-cookie'] as string[])
    .map((entry) => entry.split(';')[0])
    .join('; ');
  assert.equal((await call('GET', '/admin/admins', {cookie})).statusCode, 200);
});

test('every admin action is in the event log', async () => {
  const events = await eventsOf(admin);
  const [newest] = events;
  assert.ok(newest);
  assert.match(newest.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(newest.actor, 'admin@north.example.com');
  const [self] = await db
    .select({name: user.name})
    .from(user)
    .where(eq(user.email, 'admin@north.example.com'));
  assert.equal(newest.actorName, self?.name);
  assert.ok(events.length >= 4);
  assert.deepEqual(
    [...events].sort((a, b) => (a.at < b.at ? 1 : -1)).map((e) => e.id),
    events.map((e) => e.id),
  );
  // Only the organization's own events.
  const south = {
    cookie: (await signIn(server, 'admin@south.example.com')).cookie,
  };
  assert.deepEqual(await eventsOf(south), []);
  assert.deepEqual(
    await db
      .select({id: members.id})
      .from(members)
      .where(eq(members.organizationId, SOUTH.id)),
    [],
  );
});

test('events are kept for a year, and named by address once the admin is gone', async () => {
  const at = (months: number) =>
    sql`now() - make_interval(months => ${months})`;
  await db.insert(adminEvents).values([
    {
      organizationId: NORTH.id,
      actor: 'gone@north.example.com',
      action: 'apartment.update',
      subject: 'kept',
      at: at(11),
    },
    {
      organizationId: NORTH.id,
      actor: 'gone@north.example.com',
      action: 'apartment.update',
      subject: 'expired',
      at: at(13),
    },
  ]);

  const events = await eventsOf(admin);
  const kept = events.find((event) => event.subject === 'kept');
  assert.equal(kept?.actorName, null);
  assert.equal(kept?.actor, 'gone@north.example.com');
  assert.equal(
    events.some((event) => event.subject === 'expired'),
    false,
  );

  // The next event written clears what is past keeping.
  const added = await call('POST', '/admin/admins', admin, {
    name: 'Valberedningen',
    email: 'valberedning@north.example.com',
  });
  assert.equal(added.statusCode, 201);
  const left = await db
    .select({subject: adminEvents.subject})
    .from(adminEvents)
    .where(
      and(
        eq(adminEvents.organizationId, NORTH.id),
        eq(adminEvents.actor, 'gone@north.example.com'),
      ),
    );
  assert.deepEqual(
    left.map((row) => row.subject),
    ['kept'],
  );
});

test('the history comes a page at a time, narrowed to an area if asked', async () => {
  await db.delete(adminEvents).where(eq(adminEvents.organizationId, NORTH.id));
  // 60 apartment events a minute apart, the last three at the same moment,
  // and an announcement among them.
  await db.insert(adminEvents).values(
    Array.from({length: 60}, (_, index) => ({
      organizationId: NORTH.id,
      actor: 'admin@north.example.com',
      action: index === 30 ? 'announcement.create' : 'apartment.update',
      subject: String(index),
      at: sql`now() - make_interval(mins => ${Math.max(index, 2)})`,
    })),
  );
  const page = async (query: string) =>
    (await call('GET', `/admin/events${query}`, admin)).json<EventPage>();

  const first = await page('');
  assert.equal(first.events.length, 50);
  assert.equal(first.next, first.events.at(-1)?.id);
  const second = await page(`?after=${first.next}`);
  assert.equal(second.events.length, 10);
  assert.equal(second.next, null);
  // Every event once, newest first, the ones sharing a moment too.
  const all = [...first.events, ...second.events];
  assert.equal(new Set(all.map((event) => event.id)).size, 60);
  assert.deepEqual(
    all.slice(3).map((event) => event.subject),
    Array.from({length: 57}, (_, index) => String(index + 3)),
  );

  const small = await page('?limit=20');
  const rest = await page(`?limit=20&after=${small.next}`);
  assert.deepEqual(
    [...small.events, ...rest.events].map((event) => event.id),
    all.slice(0, 40).map((event) => event.id),
  );

  const announcements = await page('?area=announcements');
  assert.deepEqual(
    announcements.events.map((event) => event.subject),
    ['30'],
  );
  assert.equal(announcements.next, null);
  const apartments = await page('?area=apartments');
  assert.equal(apartments.events.length, 50);
  assert.equal(
    (await page(`?area=apartments&after=${apartments.next}`)).events.length,
    9,
  );

  // Another organization's event ends the history rather than paging it.
  const south = {
    cookie: (await signIn(server, 'admin@south.example.com')).cookie,
  };
  const foreign = await call('GET', `/admin/events?after=${first.next}`, south);
  assert.deepEqual(foreign.json<EventPage>(), {events: [], next: null});
  assert.equal(
    (await call('GET', '/admin/events?limit=51', admin)).statusCode,
    400,
  );
});

test('a change to the settings names the parts it touched by key', async () => {
  const changed = await call('PATCH', '/admin/organization', admin, {
    name: NORTH.name,
    locales: ['sv', 'en'],
  });
  assert.equal(changed.statusCode, 200);

  const [newest] = await eventsOf(admin);
  assert.equal(newest?.action, 'organization.update');
  assert.equal(newest?.subject, 'name,locales');
});
