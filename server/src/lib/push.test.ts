import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';

import {expoAndWebPush} from './push.js';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function expoTokens(count: number) {
  return Array.from({length: count}, (_, index) => ({
    to: `ExponentPushToken[${index}]`,
    title: 'En tid blev ledig',
    body: 'Tvättstuga 1',
    channel: 'slots' as const,
  }));
}

test('expo gets at most a hundred messages a request', async () => {
  const sizes: number[] = [];

  globalThis.fetch = async (_, init) => {
    const body = JSON.parse(String(init?.body)) as unknown[];
    sizes.push(body.length);
    return Response.json({
      data: body.map((_, index) => ({status: 'ok', id: `${index}`})),
    });
  };

  const {failures, receipts} = await expoAndWebPush.send(expoTokens(250));

  assert.deepEqual(failures, []);
  assert.equal(receipts.length, 250);
  assert.deepEqual(
    sizes.sort((a, b) => b - a),
    [100, 100, 50],
  );
});

test('a rejected request fails only its own hundred', async () => {
  let calls = 0;

  globalThis.fetch = async (_, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as unknown[];
    return calls === 1
      ? new Response(null, {status: 500})
      : Response.json({
          data: body.map((_, index) => ({status: 'ok', id: `${index}`})),
        });
  };

  const {failures, receipts} = await expoAndWebPush.send(expoTokens(150));

  assert.equal(calls, 2);
  // The batches go out in order, so the first hundred are the ones failed.
  assert.deepEqual(
    failures.map((failure) => failure.token),
    expoTokens(100).map((message) => message.to),
  );
  assert.ok(failures.every((failure) => !failure.unregistered));
  assert.equal(receipts.length, 50);
});

test('a ticket names its message, and a receipt the device it failed on', async () => {
  const [kept, gone] = expoTokens(2);
  const requests: unknown[] = [];

  globalThis.fetch = async (url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return String(url).endsWith('/getReceipts')
      ? Response.json({
          data: {
            a: {status: 'ok'},
            b: {
              status: 'error',
              message: 'not registered',
              details: {error: 'DeviceNotRegistered'},
            },
          },
        })
      : Response.json({
          data: [
            {status: 'ok', id: 'a'},
            {status: 'ok', id: 'b'},
          ],
        });
  };

  const {receipts} = await expoAndWebPush.send([kept!, gone!]);
  const failures = await expoAndWebPush.checkReceipts(receipts);

  assert.deepEqual(receipts, [
    {id: 'a', token: kept!.to},
    {id: 'b', token: gone!.to},
  ]);
  assert.deepEqual(requests[1], {ids: ['a', 'b']});
  assert.deepEqual(failures, [
    {token: gone!.to, message: 'not registered', unregistered: true},
  ]);
});

test('a receipt that is not ready yet is no failure', async () => {
  globalThis.fetch = async () => Response.json({data: {}});

  assert.deepEqual(
    await expoAndWebPush.checkReceipts([
      {id: 'a', token: 'ExponentPushToken[0]'},
    ]),
    [],
  );
});
