import {describe, expect, test, vi} from 'vitest';

import {createApi} from './createApi';
import {codeOf} from './errors';

function setup() {
  const onUnauthorized = vi.fn();
  const {unwrap} = createApi({
    baseUrl: 'http://localhost',
    credentials: 'omit',
    headers: () => ({}),
    onUnauthorized,
  });

  return {unwrap, onUnauthorized};
}

function answer(status: number, body: {data?: string; error?: object}) {
  return Promise.resolve({...body, response: new Response(null, {status})});
}

async function failure(request: Promise<unknown>) {
  return request.then(
    () => null,
    (error: unknown) => codeOf(error),
  );
}

describe('unwrap', () => {
  test('returns the data of a good answer', async () => {
    const {unwrap} = setup();

    await expect(unwrap(answer(200, {data: 'ok'}))).resolves.toBe('ok');
  });

  test('throws the code the server sends', async () => {
    const {unwrap, onUnauthorized} = setup();

    expect(
      await failure(unwrap(answer(409, {error: {code: 'SLOT_TAKEN'}}))),
    ).toBe('SLOT_TAKEN');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test('a code the client does not know is unknown', async () => {
    const {unwrap} = setup();

    expect(await failure(unwrap(answer(400, {error: {code: 'NEW'}})))).toBe(
      'UNKNOWN',
    );
  });

  test('a rejected session is reported', async () => {
    const {unwrap, onUnauthorized} = setup();

    expect(
      await failure(unwrap(answer(401, {error: {code: 'UNAUTHORIZED'}}))),
    ).toBe('UNAUTHORIZED');
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  test('a server failure hides its body', async () => {
    const {unwrap} = setup();

    expect(
      await failure(unwrap(answer(503, {error: {code: 'SLOT_TAKEN'}}))),
    ).toBe('SERVER_ERROR');
  });

  test('tells a timeout from a lost network', async () => {
    const {unwrap} = setup();
    const abort = Object.assign(new Error('aborted'), {name: 'AbortError'});

    expect(await failure(unwrap(Promise.reject(abort)))).toBe('TIMEOUT');
    expect(await failure(unwrap(Promise.reject(new TypeError())))).toBe(
      'NETWORK',
    );
  });
});
