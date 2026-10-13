import {describe, expect, test} from 'vitest';

import type {Account} from '../api/types';
import {accountView, forgetsAccount} from './account';

const MEMBER: Account = {
  organizationName: 'Brf Exempel',
  locales: ['sv', 'en'],
  member: {apartment: '12'},
  admin: null,
};

const ADMIN: Account = {
  organizationName: 'Brf Exempel',
  locales: ['sv'],
  member: null,
  admin: {untranslated: null},
};

const BOTH: Account = {
  organizationName: 'Brf Exempel',
  locales: ['sv'],
  member: {apartment: '12'},
  admin: {untranslated: null},
};

describe('accountView', () => {
  test("renders an apartment's app", () => {
    expect(accountView(MEMBER, null, null)).toEqual({
      kind: 'member',
      account: {
        organizationName: 'Brf Exempel',
        locales: ['sv', 'en'],
        apartment: '12',
        admin: false,
      },
    });
  });

  test("renders the admin's app", () => {
    expect(accountView(ADMIN, null, null)).toEqual({
      kind: 'admin',
      account: {
        organizationName: 'Brf Exempel',
        locales: ['sv'],
        untranslated: null,
        apartment: null,
      },
    });
  });

  test('an account with both starts as an apartment and can switch', () => {
    expect(accountView(BOTH, null, null)).toMatchObject({
      kind: 'member',
      account: {apartment: '12', admin: true},
    });
    expect(accountView(BOTH, null, 'admin')).toMatchObject({
      kind: 'admin',
      account: {apartment: '12'},
    });
    expect(accountView(BOTH, null, 'member')).toMatchObject({kind: 'member'});
  });

  test('a mode the account lacks falls back to what it has', () => {
    expect(accountView(MEMBER, null, 'admin')).toMatchObject({kind: 'member'});
    expect(accountView(ADMIN, null, 'member')).toMatchObject({kind: 'admin'});
  });

  test('keeps the account shown through a failed refresh', () => {
    expect(accountView(MEMBER, 'NETWORK', null)).toMatchObject({
      kind: 'member',
    });
  });

  test('waits for the first answer', () => {
    expect(accountView(null, null, null)).toEqual({kind: 'waiting'});
  });

  test('tells a moved-out apartment, which a retry cannot fix', () => {
    expect(accountView(null, 'UNAUTHORIZED', null)).toEqual({
      kind: 'moved-out',
    });
  });

  test('offers a retry for any other failure', () => {
    expect(accountView(null, 'TIMEOUT', null)).toEqual({
      kind: 'failed',
      error: 'TIMEOUT',
    });
  });
});

describe('forgetsAccount', () => {
  test('forgets the account only when no apartment answers for it', () => {
    expect(forgetsAccount('UNAUTHORIZED')).toBe(true);
    expect(forgetsAccount('NETWORK')).toBe(false);
    expect(forgetsAccount('SERVER_ERROR')).toBe(false);
  });
});
