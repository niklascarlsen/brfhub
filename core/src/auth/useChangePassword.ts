import {useEffect, useState} from 'react';

import {checkPassword, type PasswordFields} from '../admin/drafts';
import {
  changePasswordProblem,
  createChangePassword,
  INITIAL_CHANGE_PASSWORD,
  type ChangePasswordOptions,
} from './changePassword';

// What the change of password shows and what its fields and button do.
export function useChangePassword(options: ChangePasswordOptions) {
  const [state, setState] = useState(INITIAL_CHANGE_PASSWORD);
  const [{use, ...change}] = useState(() =>
    createChangePassword(options, state, setState),
  );

  useEffect(() => use(options));

  return {
    ...change,
    ...state,
    changed: checkPassword(state.fields, options.t).changed,
    problem: (field: keyof PasswordFields) =>
      changePasswordProblem(state, field, options.t),
  };
}
