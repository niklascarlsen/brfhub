import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

// The server as it runs in production, which the other tests never see:
// the dev routes gone, and sign-in attempts counted per client address.
// The mode is read when the modules load, so they are imported after it
// is set, and node:test runs each file in its own process.
process.env.NODE_ENV = 'production';
process.env.WEB_ORIGIN = 'http://localhost:5173';
process.env.SMTP_URL = 'smtp://localhost:1025';
process.env.MAIL_FROM = 'Boka <boka@localhost>';

const {buildApp} = await import('./app.js');
const {pool} = await import('./db/index.js');
const {
  assertTestDatabase,
  codeOf,
  memoryMail,
  memoryPush,
  ORIGIN,
  resetDatabase,
  seedOrganization,
} = await import('./test/fixtures.js');

const NORTH = {
  id: 'north',
  name: 'Brf Norr',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 30,
};

const ADMIN = 'admin@north.example.com';
// The load balancer in front of the server, whose x-forwarded-for is
// believed, and a peer reaching the server directly, whose is not.
const PROXY = '10.0.0.1';
const DIRECT = '203.0.113.9';

let server: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
  await assertTestDatabase();
  server = await buildApp({
    logger: false,
    push: memoryPush().send,
    mail: memoryMail().send,
    trustProxy: '10.0.0.0/8',
  });
  await resetDatabase();
  await seedOrganization({
    organization: NORTH,
    kinds: [],
    resources: [],
    slots: [],
    apartments: ['1'],
    emailOf: (apartment) => `${apartment}@north.example.com`,
    adminEmail: ADMIN,
  });
});

after(async () => {
  await server.close();
  await pool.end();
});

// A sign-in with the wrong password, as from the given client behind the
// given peer.
function attempt(remoteAddress: string, forwardedFor?: string) {
  return server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    remoteAddress,
    headers: {
      origin: ORIGIN,
      ...(forwardedFor ? {'x-forwarded-for': forwardedFor} : {}),
    },
    payload: {email: ADMIN, password: 'fel-losen'},
  });
}

test('the dev routes and the API document are gone', async () => {
  const docs = await server.inject({method: 'GET', url: '/docs'});
  assert.equal(docs.statusCode, 404);

  const codes = await server.inject({
    method: 'GET',
    url: `/dev/codes?email=${ADMIN}`,
  });
  assert.equal(codes.statusCode, 404);
});

test('sign-in attempts are counted per client behind a trusted proxy', async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    statuses.push((await attempt(PROXY, '198.51.100.1')).statusCode);
  }
  assert.deepEqual(statuses, [401, 401, 401, 429]);

  // Another client behind the same proxy has attempts of its own.
  const other = await attempt(PROXY, '198.51.100.2');
  assert.equal(other.statusCode, 401);
});

test('a client reaching the server directly cannot name another address', async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    statuses.push((await attempt(DIRECT, `198.51.100.${10 + i}`)).statusCode);
  }
  assert.deepEqual(statuses, [401, 401, 401, 429]);
});

test('asking how an address signs in is counted too', async () => {
  let last = 0;
  for (let i = 0; i < 11; i++) {
    const response = await server.inject({
      method: 'POST',
      url: '/sign-in/method',
      remoteAddress: '203.0.113.20',
      payload: {email: ADMIN},
    });
    last = response.statusCode;
    if (last === 429) {
      assert.equal(codeOf(response), 'RATE_LIMITED');
      break;
    }
    assert.equal(last, 200);
  }
  assert.equal(last, 429);
});

test('the answers carry the usual security headers', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/account',
    remoteAddress: '203.0.113.30',
  });
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.ok(response.headers['strict-transport-security']);
});
