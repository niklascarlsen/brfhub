import {describe, expect, test} from 'vitest';

import {sv as t} from '../i18n/sv';
import {fakeAuth} from '../test/fakeAuth';
import {
  changePasswordProblem,
  createChangePassword,
  INITIAL_CHANGE_PASSWORD,
} from './changePassword';

const NEW_PASSWORD = 'a new password';

function start() {
  const fake = fakeAuth();
  let state = INITIAL_CHANGE_PASSWORD;
  const change = createChangePassword({auth: fake.auth, t}, state, (next) => {
    state = next;
  });

  function fill() {
    change.edit('current', 'password');
    change.edit('next', NEW_PASSWORD);
    change.edit('repeat', NEW_PASSWORD);
  }

  return {...fake, change, fill, state: () => state};
}

describe('changing the password', () => {
  test('signs every other device out and starts the form over', async () => {
    const {change, fill, state, calls} = start();
    fill();
    change.leave('next');

    await change.submit();

    expect(calls).toEqual([
      {
        name: 'changePassword',
        body: {
          currentPassword: 'password',
          newPassword: NEW_PASSWORD,
          revokeOtherSessions: true,
        },
      },
    ]);
    expect(state().fields).toEqual({current: '', next: '', repeat: ''});
    expect(state().message).toBe(t.admin.organization.passwordChanged);
    expect(state().submitting).toBe(false);
    expect(changePasswordProblem(state(), 'next', t)).toBeNull();
  });

  test('shows what is wrong instead of sending', async () => {
    const {change, state, calls} = start();
    change.edit('next', 'short');

    await change.submit();

    expect(calls).toEqual([]);
    expect(changePasswordProblem(state(), 'current', t)).toBe(
      t.admin.field.required,
    );
    expect(changePasswordProblem(state(), 'next', t)).toBe(
      t.admin.organization.passwordTooShort(8),
    );
  });

  test("tells Better Auth's refusals in words", async () => {
    const cases = [
      [
        {status: 400, code: 'INVALID_PASSWORD'},
        t.admin.organization.wrongPassword,
      ],
      [
        {status: 400, code: 'PASSWORD_TOO_LONG'},
        t.admin.organization.passwordTooLong(128),
      ],
      [{status: 429}, t.login.tooManyAttempts],
      [{status: 400}, t.errors.UNKNOWN],
      ['network', t.errors.NETWORK],
    ] as const;

    for (const [failure, message] of cases) {
      const {change, fill, state, answer} = start();
      answer('changePassword', failure);
      fill();
      await change.submit();

      expect(state().message).toBe(message);
      expect(state().fields.current).toBe('password');
      expect(state().submitting).toBe(false);
    }
  });

  test('a second press while one is on its way sends nothing', async () => {
    const {change, fill, calls} = start();
    fill();

    const first = change.submit();
    await change.submit();
    await first;

    expect(calls).toHaveLength(1);
  });
});
