import {describe, expect, test} from 'vitest';

import {sessionView} from './session';

const SESSION = {user: {id: '1'}};
const FIRST = {error: null, answered: false};
const LATER = {error: null, answered: true};

describe('sessionView', () => {
  test('renders the app with a live session', () => {
    expect(sessionView({session: SESSION, isPending: false, ...FIRST})).toBe(
      'signed-in',
    );
  });

  test('keeps the app through a check of the same session', () => {
    expect(sessionView({session: SESSION, isPending: true, ...LATER})).toBe(
      'signed-in',
    );
    expect(
      sessionView({
        session: SESSION,
        isPending: false,
        error: new Error(),
        answered: true,
      }),
    ).toBe('signed-in');
  });

  test('waits for the first check only', () => {
    expect(sessionView({session: null, isPending: true, ...FIRST})).toBe(
      'waiting',
    );
    // A check after a sign-in attempt keeps the sign-in screen, which is
    // in the middle of its steps.
    expect(sessionView({session: null, isPending: true, ...LATER})).toBe(
      'signed-out',
    );
  });

  test('offers a retry when the check fails', () => {
    expect(
      sessionView({
        session: null,
        isPending: false,
        error: new Error(),
        answered: true,
      }),
    ).toBe('failed');
  });

  test('asks to sign in without a session', () => {
    expect(sessionView({session: null, isPending: false, ...LATER})).toBe(
      'signed-out',
    );
  });
});
