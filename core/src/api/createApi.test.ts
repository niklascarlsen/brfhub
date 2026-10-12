import {afterEach, describe, expect, test, vi} from 'vitest';

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

describe('requests', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('carry the headers as they are when each is sent', async () => {
    const seen: Request[] = [];
    vi.stubGlobal('fetch', async (request: Request) => {
      seen.push(request);
      return Response.json({});
    });

    const locales = ['sv', 'en'];
    const headers = vi.fn(() => ({
      cookie: 'session=1',
      'accept-language': locales[headers.mock.calls.length - 1] ?? '',
    }));
    const {api, unwrap} = createApi({
      baseUrl: 'http://localhost',
      credentials: 'include',
      headers,
      onUnauthorized: () => {},
    });

    await unwrap(api.GET('/booking-window'));
    await unwrap(api.GET('/resources'));

    expect(headers).toHaveBeenCalledTimes(2);
    expect(
      seen.map((request) => request.headers.get('accept-language')),
    ).toEqual(['sv', 'en']);
    expect(seen.map((request) => request.headers.get('cookie'))).toEqual([
      'session=1',
      'session=1',
    ]);
    expect(seen.map((request) => request.credentials)).toEqual([
      'include',
      'include',
    ]);
  });

  test('give up after ten seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      (_: Request, init: {signal: AbortSignal}) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), {name: 'AbortError'}));
          });
        }),
    );

    const {api, unwrap} = createApi({
      baseUrl: 'http://localhost',
      credentials: 'omit',
      headers: () => ({}),
      onUnauthorized: () => {},
    });

    let code: string | null = null;
    void failure(unwrap(api.GET('/booking-window'))).then((result) => {
      code = result;
    });

    await vi.advanceTimersByTimeAsync(9_999);
    expect(code).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(code).toBe('TIMEOUT');
  });
});
