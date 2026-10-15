import {checkPassword, hasProblems, type PasswordFields} from '../admin/drafts';
import {
  leaveField,
  nothingShown,
  problemShown,
  type Shown,
} from '../admin/useProblems';
import type {Messages} from '../i18n/catalog';
import {ask, type AuthClient} from './authClient';
import {changeFailure} from './failures';

export type ChangePasswordState = {
  fields: PasswordFields;
  shown: Shown<keyof PasswordFields>;
  // What became of the last try: changed, or why not.
  message: string | null;
  submitting: boolean;
};

export type ChangePasswordOptions = {auth: AuthClient; t: Messages};

const EMPTY: PasswordFields = {current: '', next: '', repeat: ''};

export const INITIAL_CHANGE_PASSWORD: ChangePasswordState = {
  fields: EMPTY,
  shown: nothingShown(),
  message: null,
  submitting: false,
};

export function changePasswordProblem(
  {fields, shown}: ChangePasswordState,
  field: keyof PasswordFields,
  t: Messages,
): string | null {
  const {problems, changed} = checkPassword(fields, t);
  return problemShown(shown, problems, field, changed);
}

// A signed-in admin changes the password, which signs every other device
// out. Each client binds it with useChangePassword.
export function createChangePassword(
  first: ChangePasswordOptions,
  initial: ChangePasswordState,
  onChange: (state: ChangePasswordState) => void,
) {
  let latest = first;
  let state = initial;
  const options = () => latest;

  function set(patch: Partial<ChangePasswordState>) {
    state = {...state, ...patch};
    onChange(state);
  }

  return {
    // The latest options, such as the language picked meanwhile, for
    // what comes next.
    use(next: ChangePasswordOptions) {
      latest = next;
    },

    edit(field: keyof PasswordFields, value: string) {
      set({fields: {...state.fields, [field]: value}});
    },

    leave(field: keyof PasswordFields) {
      set({shown: leaveField(state.shown, field)});
    },

    // With something wrong it shows every problem instead of sending.
    async submit() {
      if (state.submitting) {
        return;
      }

      const {auth, t} = options();
      set({message: null});

      if (hasProblems(checkPassword(state.fields, t).problems)) {
        set({shown: {...state.shown, tried: true}});
        return;
      }

      set({submitting: true});
      const outcome = await ask(
        auth.changePassword({
          currentPassword: state.fields.current,
          newPassword: state.fields.next,
          revokeOtherSessions: true,
        }),
      );

      if (!outcome.ok) {
        set({submitting: false, message: changeFailure(outcome.failure, t)});
        return;
      }

      // The form starts over, so nothing is marked until it is edited
      // again.
      set({
        ...INITIAL_CHANGE_PASSWORD,
        message: t.admin.organization.passwordChanged,
      });
    },
  };
}
