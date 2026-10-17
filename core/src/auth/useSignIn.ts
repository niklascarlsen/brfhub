import {useEffect, useState} from 'react';

import type {PasswordResetFields} from '../admin/drafts';
import {
  canSubmit,
  createSignIn,
  initialSignIn,
  resetProblem,
  secondsToResend,
  type SignInOptions,
} from './signIn';

type UseSignInOptions = SignInOptions & {
  prefill: {email: string; password: string};
};

// What the login screen shows and what its fields and buttons do. The
// screen renders the step it is given.
export function useSignIn({prefill, ...options}: UseSignInOptions) {
  const [state, setState] = useState(() => initialSignIn(prefill));
  // The clock the countdown to a new code is read against: set with every
  // change, so a code just sent counts from now, and each second while
  // the countdown runs.
  const [now, setNow] = useState(Date.now);
  const [{use, ...signIn}] = useState(() =>
    createSignIn(options, state, (next) => {
      setState(next);
      setNow(Date.now());
    }),
  );

  useEffect(() => use(options));

  // On each whole second left, as the countdown shows them.
  const {resendAt} = state;
  useEffect(() => {
    if (resendAt === null || resendAt <= now) {
      return;
    }

    const tick = setTimeout(
      () => setNow(Date.now()),
      (resendAt - now) % 1000 || 1000,
    );
    return () => clearTimeout(tick);
  }, [resendAt, now]);

  return {
    ...signIn,
    ...state,
    canSubmit: canSubmit(state),
    // Seconds until a new code may be asked for, none once it may.
    resendIn: secondsToResend(state, now),
    resetProblem: (field: keyof PasswordResetFields) =>
      resetProblem(state, field, options.t),
  };
}
