import type {ClientErrorCode} from '../api/errors';
import type {Account, AdminAccount, MemberAccount} from '../api/types';

// Signed in but no apartment answers for this account: it has moved out
// since the last answer, so its app stops showing. Other failures keep the
// account shown.
export function forgetsAccount(code: ClientErrorCode): boolean {
  return code === 'UNAUTHORIZED';
}

export type AccountView =
  | {kind: 'member'; account: MemberAccount}
  | {kind: 'admin'; account: AdminAccount}
  // Retrying cannot fix it, only signing out.
  | {kind: 'moved-out'}
  | {kind: 'failed'; error: ClientErrorCode}
  | {kind: 'waiting'};

// What AccountGate shows for what the server last said about who signed
// in. A refresh keeps showing the account it has until the new one comes.
export function accountView(
  account: Account | null,
  error: ClientErrorCode | null,
): AccountView {
  if (account !== null) {
    return account.role === 'admin'
      ? {kind: 'admin', account}
      : {kind: 'member', account};
  }

  if (error === null) {
    return {kind: 'waiting'};
  }

  return forgetsAccount(error) ? {kind: 'moved-out'} : {kind: 'failed', error};
}
