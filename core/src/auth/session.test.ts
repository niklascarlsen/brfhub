import {describe, expect, test} from 'vitest';

import {sessionView} from './session';

const SESSION = {user: {id: '1'}};

describe('sessionView', () => {
  test('renders the app with a live session', () => {
    expect(sessionView({session: SESSION, isPending: false, error: null})).toBe(
      'signed-in',
    );
  });

  test('keeps the app through a check of the same session', () => {
    expect(sessionView({session: SESSION, isPending: true, error: null})).toBe(
      'signed-in',
    );
    expect(
      sessionView({session: SESSION, isPending: false, error: new Error()}),
    ).toBe('signed-in');
  });

  test('waits for the first check', () => {
    expect(sessionView({session: null, isPending: true, error: null})).toBe(
      'waiting',
    );
  });

  test('offers a retry when the check fails', () => {
    expect(
      sessionView({session: null, isPending: false, error: new Error()}),
    ).toBe('failed');
  });

  test('asks to sign in without a session', () => {
    expect(sessionView({session: null, isPending: false, error: null})).toBe(
      'signed-out',
    );
  });
});
