import {eq, sql} from 'drizzle-orm';

import type {buildApp} from '../app.js';
import {createUser, enrollTwoFactor, totpCode} from '../auth/auth.service.js';
import {db} from '../db/index.js';
import {
  codeRequests,
  members,
  organizations,
  resourceKinds,
  resourceSlots,
  resources,
  session,
  user,
} from '../db/schema.js';
import type {Locale} from '../lib/locale.js';
import type {Mail, SendMail} from '../lib/mail.js';
import type {PushFailure, PushMessage, PushTransport} from '../lib/push.js';

// The admins' password. Apartments sign in with a code from their mail.
export const PASSWORD = 'password';
// Every seeded admin's authenticator secret, so signIn can give the code.
export const TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
export const ORIGIN = 'http://localhost:5173';

type Server = Awaited<ReturnType<typeof buildApp>>;

// Push that stays in memory: keeps what the server would have sent, and
// answers with the failures a test hands it, at once or in the receipts.
// A held push does not answer until the test lets it go, like a push
// service that hangs.
export function memoryPush() {
  const sent: PushMessage[] = [];
  let failures: PushFailure[] = [];
  let receiptFailures: PushFailure[] = [];
  let held: Promise<void> | null = null;
  let release = () => {};

  const failuresFor = (all: PushFailure[], tokens: string[]) =>
    all.filter((failure) => tokens.includes(failure.token));

  const transport: PushTransport = {
    async send(messages) {
      await held;
      sent.push(...messages);
      const tokens = messages.map((message) => message.to);
      return {
        failures: failuresFor(failures, tokens),
        receipts: tokens.map((token, index) => ({
          id: `${sent.length + index}`,
          token,
        })),
      };
    },
    async checkReceipts(receipts) {
      return failuresFor(
        receiptFailures,
        receipts.map((receipt) => receipt.token),
      );
    },
  };

  return {
    ...transport,
    sent,
    failWith(next: PushFailure[]) {
      failures = next;
    },
    failReceiptsWith(next: PushFailure[]) {
      receiptFailures = next;
    },
    hold(): () => void {
      if (held) {
        return release;
      }
      held = new Promise((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
      return release;
    },
    clear() {
      release();
      sent.length = 0;
      failures = [];
      receiptFailures = [];
    },
  };
}

// Mail that stays in memory. The newest mailbox is the one signIn reads
// the apartments' codes from, so a test file makes one and hands its send
// to buildApp.
let mailbox: ReturnType<typeof memoryMail> | null = null;

export function memoryMail() {
  const sent: Mail[] = [];
  // Addresses the SMTP service refuses, as a test sets them.
  let refused = new Set<string>();
  const send: SendMail = async (mail) => {
    if (refused.has(mail.to)) {
      throw new Error(`550 ${mail.to} refused`);
    }
    sent.push(mail);
  };

  const box = {
    send,
    sent,
    refuse(addresses: string[]) {
      refused = new Set(addresses);
    },
    // The newest mail to the address, sent after the given count of mails.
    lastTo(to: string, since = 0): Mail | undefined {
      return sent
        .slice(since)
        .filter((mail) => mail.to === to.toLowerCase())
        .at(-1);
    },
  };
  mailbox = box;

  return box;
}

// The sign-in code in the newest mail to the address, or null when none
// has come since the given count of sent mails.
export function codeSentTo(email: string, since = 0): string | null {
  return mailbox?.lastTo(email, since)?.text.match(/\b\d{6}\b/)?.[0] ?? null;
}

export async function assertTestDatabase() {
  const [connection] = (
    await db.execute<{name: string}>(sql`select current_database() as name`)
  ).rows;

  if (!connection?.name.endsWith('_test')) {
    throw new Error(
      `Refusing to run against ${connection?.name ?? 'unknown database'}, expected a _test database`,
    );
  }
}

// Lets the address be mailed a code at once, as if the last were long
// ago: tests sign the same apartment in again and again.
export async function forgetCodeRequests(email: string) {
  await db
    .delete(codeRequests)
    .where(eq(codeRequests.email, email.trim().toLowerCase()));
}

export async function resetDatabase() {
  await db.execute(
    sql`truncate organizations, announcements, members, resource_kinds, resources, resource_slots, bookings, subscriptions, push_tokens, code_requests, "user" cascade`,
  );
}

type OrganizationSeed = {
  // In Swedish alone unless a test says otherwise.
  organization: Omit<typeof organizations.$inferInsert, 'locales'> & {
    locales?: Locale[];
  };
  kinds: Omit<typeof resourceKinds.$inferInsert, 'organizationId'>[];
  resources: Omit<typeof resources.$inferInsert, 'organizationId'>[];
  // Valid since long before any test day unless a test says otherwise.
  slots: (Omit<typeof resourceSlots.$inferInsert, 'validFrom'> & {
    validFrom?: string;
  })[];
  apartments: string[];
  emailOf: (apartment: string) => string;
  adminEmail: string;
};

// One organization with its resources, an account per apartment and its
// admin, who signs in with PASSWORD and an authenticator on TOTP_SECRET.
// Returns the member id per apartment.
export async function seedOrganization(
  seed: OrganizationSeed,
): Promise<Map<string, string>> {
  const organizationId = seed.organization.id;

  await db
    .insert(organizations)
    .values({locales: ['sv'], ...seed.organization});

  if (seed.kinds.length > 0) {
    await db
      .insert(resourceKinds)
      .values(seed.kinds.map((kind) => ({...kind, organizationId})));
  }
  if (seed.resources.length > 0) {
    await db
      .insert(resources)
      .values(
        seed.resources.map((resource) => ({...resource, organizationId})),
      );
  }
  if (seed.slots.length > 0) {
    await db
      .insert(resourceSlots)
      .values(seed.slots.map((slot) => ({validFrom: '2000-01-01', ...slot})));
  }

  const rows =
    seed.apartments.length === 0
      ? []
      : await db
          .insert(members)
          .values(seed.apartments.map((label) => ({organizationId, label})))
          .returning({id: members.id, label: members.label});

  for (const row of rows) {
    await createUser({
      email: seed.emailOf(row.label),
      name: `Lägenhet ${row.label}`,
      organizationId,
      memberId: row.id,
    });
  }

  const admin = await createUser({
    email: seed.adminEmail,
    password: PASSWORD,
    name: `Admin ${seed.organization.name}`,
    organizationId,
    admin: true,
  });
  await enrollTwoFactor(admin.id, TOTP_SECRET);

  return new Map(rows.map((row) => [row.label, row.id]));
}

export function cookieFrom(response: {
  headers: {'set-cookie'?: string | string[]};
}) {
  const setCookie = response.headers['set-cookie'] ?? [];

  return (Array.isArray(setCookie) ? setCookie : [setCookie])
    .map((entry) => entry.split(';')[0])
    .join('; ');
}

// Signs in through the auth routes the clients use, with the password when
// the account is an admin's and otherwise with the code it is mailed, and
// folds Set-Cookie into the Cookie header the next request sends. A given
// password is always tried, so a test can see one refused.
export async function signIn(server: Server, email: string, password?: string) {
  const [account] = await db
    .select({admin: user.admin})
    .from(user)
    .where(eq(user.email, email.toLowerCase()));

  if (password !== undefined || account?.admin) {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: {origin: ORIGIN},
      payload: {email, password: password ?? PASSWORD},
    });

    // An admin with an authenticator is asked for its code next, which the
    // seeded secret gives.
    if (
      response.statusCode === 200 &&
      response.json<{twoFactorRedirect?: boolean}>().twoFactorRedirect
    ) {
      const verified = await server.inject({
        method: 'POST',
        url: '/auth/two-factor/verify-totp',
        headers: {origin: ORIGIN, cookie: cookieFrom(response)},
        payload: {code: await totpCode(TOTP_SECRET)},
      });

      return {response: verified, cookie: cookieFrom(verified)};
    }

    return {response, cookie: cookieFrom(response)};
  }

  await forgetCodeRequests(email);
  const before = mailbox?.sent.length ?? 0;
  const sent = await server.inject({
    method: 'POST',
    url: '/auth/email-otp/send-verification-otp',
    headers: {origin: ORIGIN},
    payload: {email, type: 'sign-in'},
  });

  if (sent.statusCode !== 200) {
    return {response: sent, cookie: ''};
  }

  // An unknown address is mailed nothing, and a made-up code is refused
  // the way the client would be.
  const response = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email-otp',
    headers: {origin: ORIGIN},
    payload: {email, otp: codeSentTo(email, before) ?? '000000'},
  });

  return {response, cookie: cookieFrom(response)};
}

// A device signed in for the apartment, for a push token to be bound to.
export async function sessionFor(memberId: string): Promise<string> {
  const [account] = await db
    .select({id: user.id})
    .from(user)
    .where(eq(user.memberId, memberId));

  if (!account) {
    throw new Error(`No account for member ${memberId}`);
  }

  const id = crypto.randomUUID();
  await db.insert(session).values({
    id,
    userId: account.id,
    token: id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  });

  return id;
}

export function codeOf(response: {json: <T>() => T}) {
  return response.json<{code: string}>().code;
}

// Resolves once another connection waits on a lock of the given kind:
// 'advisory', or 'transactionid' for a row another transaction is
// changing. A test that holds a lock then knows the request it fired has
// reached it, without guessing how long that takes.
export async function waitUntilBlocked(waitEvent: string): Promise<void> {
  const deadline = Date.now() + 5_000;

  for (;;) {
    const {rows} = await db.execute<{waiting: number}>(
      sql`select count(*)::int as waiting from pg_stat_activity
          where datname = current_database()
            and wait_event_type = 'Lock' and wait_event = ${waitEvent}`,
    );

    if ((rows[0]?.waiting ?? 0) > 0) {
      return;
    }

    if (Date.now() > deadline) {
      throw new Error(`Nothing waited on a lock of kind ${waitEvent}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
