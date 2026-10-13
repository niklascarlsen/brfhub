import {describe, expect, test} from 'vitest';

import type {AdminAccount, MemberAccount} from '../api/types';
import {accountView, forgetsAccount} from './account';

const MEMBER: MemberAccount = {
  role: 'member',
  organizationName: 'Brf Exempel',
  locales: ['sv', 'en'],
  apartment: '12',
};

const ADMIN: AdminAccount = {
  role: 'admin',
  organizationName: 'Brf Exempel',
  locales: ['sv'],
  untranslated: null,
};

describe('accountView', () => {
  test("renders an apartment's app", () => {
    expect(accountView(MEMBER, null)).toEqual({
      kind: 'member',
      account: MEMBER,
    });
  });

  test("renders the admin's app", () => {
    expect(accountView(ADMIN, null)).toEqual({kind: 'admin', account: ADMIN});
  });

  test('keeps the account shown through a failed refresh', () => {
    expect(accountView(MEMBER, 'NETWORK')).toEqual({
      kind: 'member',
      account: MEMBER,
    });
  });

  test('waits for the first answer', () => {
    expect(accountView(null, null)).toEqual({kind: 'waiting'});
  });

  test('tells a moved-out apartment, which a retry cannot fix', () => {
    expect(accountView(null, 'UNAUTHORIZED')).toEqual({kind: 'moved-out'});
  });

  test('offers a retry for any other failure', () => {
    expect(accountView(null, 'TIMEOUT')).toEqual({
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
