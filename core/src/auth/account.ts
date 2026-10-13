import type {ClientErrorCode} from '../api/errors';
import type {Account} from '../api/types';

// Signed in but no apartment answers for this account: it has moved out
// since the last answer, so its app stops showing. Other failures keep the
// account shown.
export function forgetsAccount(code: ClientErrorCode): boolean {
  return code === 'UNAUTHORIZED';
}

// Which of its apps an account is shown. An account that is both books
// and manages, and switches between the two.
export type Mode = 'member' | 'admin';

// What the apartment's app knows about who signed in. admin says whether
// the admin's app is a switch away.
export type MemberAccount = {
  organizationName: string;
  locales: Account['locales'];
  apartment: string;
  admin: boolean;
};

// What the admin's app knows. apartment is the one it also books for, if
// any, and so whether the apartment's app is a switch away.
export type AdminAccount = {
  organizationName: string;
  locales: Account['locales'];
  untranslated: NonNullable<Account['admin']>['untranslated'];
  apartment: string | null;
};

export type AccountView =
  | {kind: 'member'; account: MemberAccount}
  | {kind: 'admin'; account: AdminAccount}
  // An admin without an authenticator set up yet, who may do nothing else.
  | {kind: 'two-factor-setup'; account: AdminAccount}
  // Retrying cannot fix it, only signing out.
  | {kind: 'moved-out'}
  | {kind: 'failed'; error: ClientErrorCode}
  | {kind: 'waiting'};

// What AccountGate shows for what the server last said about who signed
// in. The mode asked for is shown when the account has it; otherwise the
// apartment's app when there is one, else the admin's. A refresh keeps
// showing the account it has until the new one comes.
export function accountView(
  account: Account | null,
  error: ClientErrorCode | null,
  mode: Mode | null,
): AccountView {
  if (account !== null) {
    const {organizationName, locales, member, admin} = account;

    if (admin !== null && (member === null || mode === 'admin')) {
      return {
        kind: admin.twoFactorEnabled ? 'admin' : 'two-factor-setup',
        account: {
          organizationName,
          locales,
          untranslated: admin.untranslated,
          apartment: member?.apartment ?? null,
        },
      };
    }

    if (member !== null) {
      return {
        kind: 'member',
        account: {
          organizationName,
          locales,
          apartment: member.apartment,
          admin: admin !== null,
        },
      };
    }

    return {kind: 'moved-out'};
  }

  if (error === null) {
    return {kind: 'waiting'};
  }

  return forgetsAccount(error) ? {kind: 'moved-out'} : {kind: 'failed', error};
}
