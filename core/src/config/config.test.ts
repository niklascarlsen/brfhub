import {afterEach, describe, expect, test, vi} from 'vitest';

import {createApi} from '../api/createApi';
import type {BookingWindow, Resource} from '../api/types';
import type {MemberAccount} from '../auth/account';
import {configView, fetchConfig} from './config';

const ACCOUNT: MemberAccount = {
  organizationName: 'Brf Exempel',
  locales: ['sv'],
  apartment: '12',
  admin: false,
};

const WINDOW: BookingWindow = {
  today: '2030-01-15',
  from: '2030-01-15',
  to: '2030-02-14',
};

const LAUNDRY: Resource = {
  id: 'laundry',
  name: 'Tvättstuga',
  kind: 'laundry',
  tags: [],
};
const SAUNA: Resource = {id: 'sauna', name: 'Bastu', kind: 'sauna', tags: []};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('configView', () => {
  test('gives the window, the resources and who books', () => {
    expect(
      configView({window: WINDOW, resources: [LAUNDRY, SAUNA]}, null, ACCOUNT),
    ).toEqual({
      kind: 'ready',
      config: {
        window: WINDOW,
        resources: [LAUNDRY, SAUNA],
        apartment: '12',
        organizationName: 'Brf Exempel',
        admin: false,
      },
    });
  });

  test('keeps the config shown through a failed refresh', () => {
    expect(
      configView({window: WINDOW, resources: [SAUNA]}, 'NETWORK', ACCOUNT),
    ).toMatchObject({kind: 'ready'});
  });

  test('tells when there is nothing to book', () => {
    expect(configView({window: WINDOW, resources: []}, null, ACCOUNT)).toEqual({
      kind: 'empty',
    });
  });

  test('waits for the first answer', () => {
    expect(configView(null, null, ACCOUNT)).toEqual({kind: 'waiting'});
  });

  test('offers a retry when the first load fails', () => {
    expect(configView(null, 'SERVER_ERROR', ACCOUNT)).toEqual({
      kind: 'failed',
      error: 'SERVER_ERROR',
    });
  });
});

describe('fetchConfig', () => {
  const api = createApi({
    baseUrl: 'http://api.test',
    credentials: 'omit',
    headers: () => ({}),
    onUnauthorized: () => {},
  });

  test('asks for the window and the resources together', async () => {
    vi.stubGlobal('fetch', async (request: Request) => {
      const path = new URL(request.url).pathname;
      return Response.json(path === '/booking-window' ? WINDOW : [LAUNDRY]);
    });

    expect(await fetchConfig(api)).toEqual({
      window: WINDOW,
      resources: [LAUNDRY],
    });
  });

  test('fails when either request does', async () => {
    vi.stubGlobal('fetch', async (request: Request) =>
      new URL(request.url).pathname === '/resources'
        ? Response.json({code: 'UNKNOWN', message: ''}, {status: 500})
        : Response.json(WINDOW),
    );

    await expect(fetchConfig(api)).rejects.toMatchObject({
      code: 'SERVER_ERROR',
    });
  });
});
