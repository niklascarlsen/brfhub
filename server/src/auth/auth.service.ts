import {auth} from './auth.js';

type NewUser = {
  email: string;
  password: string;
  name: string;
  organizationId: string;
} & ({role: 'member'; memberId: string} | {role: 'admin'});

// Sign-up over HTTP is disabled, so accounts are created here the way the
// sign-up route would: a user plus a credential account with the hash.
export async function createUser(newUser: NewUser) {
  const {email, password, name, organizationId, role} = newUser;
  const {internalAdapter, password: passwords} = await auth.$context;

  const user = await internalAdapter.createUser(
    {
      email,
      name,
      role,
      organizationId,
      memberId: newUser.role === 'member' ? newUser.memberId : null,
    },
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
