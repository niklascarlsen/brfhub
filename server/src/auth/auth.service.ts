import {auth} from './auth.js';

type NewUser = {
  email: string;
  password: string;
  name: string;
  memberId?: string;
};

// Sign-up over HTTP is disabled, so accounts are created here the way the
// sign-up route would: a user plus a credential account with the hash.
export async function createUser({email, password, name, memberId}: NewUser) {
  const {internalAdapter, password: passwords} = await auth.$context;

  const user = await internalAdapter.createUser(
    {email, name, memberId: memberId ?? null},
    {method: 'email-password'},
  );

  await internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: await passwords.hash(password),
  });

  return user;
}
