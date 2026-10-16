import {useEffect, useState} from 'react';

import {
  canSubmitSetup,
  createTwoFactorSetup,
  initialSetup,
  type SetupOptions,
} from './twoFactorSetup';

type UseTwoFactorSetupOptions = SetupOptions & {prefill: {password: string}};

// What the authenticator's setup shows and what its fields and buttons do.
export function useTwoFactorSetup({
  prefill,
  ...options
}: UseTwoFactorSetupOptions) {
  const [state, setState] = useState(() => initialSetup(prefill.password));
  const [{use, ...setup}] = useState(() =>
    createTwoFactorSetup(options, state, setState),
  );

  useEffect(() => use(options));

  return {...setup, ...state, canSubmit: canSubmitSetup(state)};
}
