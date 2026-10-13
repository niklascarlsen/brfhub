import {sql} from 'drizzle-orm';

import type {buildApp} from '../app.js';
import {createUser} from '../auth/auth.service.js';
import {db} from '../db/index.js';
import {
  members,
  organizations,
  resourceKinds,
  resourceSlots,
  resources,
} from '../db/schema.js';
import type {Locale} from '../lib/locale.js';
import type {PushFailure, PushMessage, SendPush} from '../lib/push.js';

export const PASSWORD = 'password';
export const ORIGIN = 'http://localhost:5173';

type Server = Awaited<ReturnType<typeof buildApp>>;

// Push that stays in memory: keeps what the server would have sent, and
// answers with the failures a test hands it. A held push does not answer
// until the test lets it go, like a push service that hangs.
export function memoryPush() {
  const sent: PushMessage[] = [];
  let failures: PushFailure[] = [];
  let held: Promise<void> | null = null;
  let release = () => {};

  const send: SendPush = async (messages) => {
    await held;
    sent.push(...messages);
    return failures.filter((failure) =>
      messages.some((message) => message.to === failure.token),
    );
  };

  return {
    send,
    sent,
    failWith(next: PushFailure[]) {
      failures = next;
    },
    hold(): () => void {
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
    },
  };
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

export async function resetDatabase() {
  await db.execute(
    sql`truncate organizations, announcements, members, resource_kinds, resources, resource_slots, bookings, subscriptions, push_tokens, "user" cascade`,
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
// admin, all signing in with PASSWORD. Returns the member id per apartment.
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
      password: PASSWORD,
      name: `Lägenhet ${row.label}`,
      organizationId,
      role: 'member',
      memberId: row.id,
    });
  }

  await createUser({
    email: seed.adminEmail,
    password: PASSWORD,
    name: `Admin ${seed.organization.name}`,
    organizationId,
    role: 'admin',
  });

  return new Map(rows.map((row) => [row.label, row.id]));
}

// Signs in through the auth route the clients use and folds Set-Cookie into
// the Cookie header the next request sends.
export async function signIn(
  server: Server,
  email: string,
  password = PASSWORD,
) {
  const response = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: {origin: ORIGIN},
    payload: {email, password},
  });

  const setCookie = response.headers['set-cookie'] ?? [];
  const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie])
    .map((entry) => entry.split(';')[0])
    .join('; ');

  return {response, cookie};
}

export function codeOf(response: {json: <T>() => T}) {
  return response.json<{code: string}>().code;
}
