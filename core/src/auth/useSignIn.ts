import {useEffect, useState} from 'react';

import type {PasswordResetFields} from '../admin/drafts';
import {
  canSubmit,
  createSignIn,
  initialSignIn,
  resetProblem,
  type SignInOptions,
} from './signIn';

type UseSignInOptions = SignInOptions & {
  prefill: {email: string; password: string};
};

// What the login screen shows and what its fields and buttons do. The
// screen renders the step it is given.
export function useSignIn({prefill, ...options}: UseSignInOptions) {
  const [state, setState] = useState(() => initialSignIn(prefill));
  const [{use, ...signIn}] = useState(() =>
    createSignIn(options, state, setState),
  );

  useEffect(() => use(options));

  return {
    ...signIn,
    ...state,
    canSubmit: canSubmit(state),
    resetProblem: (field: keyof PasswordResetFields) =>
      resetProblem(state, field, options.t),
  };
}
