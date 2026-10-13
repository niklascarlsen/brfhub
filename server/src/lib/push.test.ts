import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';

import {sendPush} from './push.js';

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
    return Response.json({data: body.map(() => ({status: 'ok'}))});
  };

  assert.deepEqual(await sendPush(expoTokens(250)), []);
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
      : Response.json({data: body.map(() => ({status: 'ok'}))});
  };

  const failures = await sendPush(expoTokens(150));

  assert.equal(calls, 2);
  // The batches go out in order, so the first hundred are the ones failed.
  assert.deepEqual(
    failures.map((failure) => failure.token),
    expoTokens(100).map((message) => message.to),
  );
  assert.ok(failures.every((failure) => !failure.unregistered));
});
