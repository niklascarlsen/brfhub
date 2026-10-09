import {randomUUID} from 'node:crypto';

import {db, type Executor} from '../db/index.js';
import {account, user} from '../db/schema.js';
import {auth} from './auth.js';

type NewUser = {
  email: string;
  password: string;
  name: string;
  organizationId: string;
} & ({role: 'member'; memberId: string} | {role: 'admin'});

// Sign-up over HTTP is disabled, so accounts are written here the way the
// sign-up route would: a user plus a credential account with the hash. Plain
// inserts rather than Better Auth's adapter, so both rows can join the
// caller's transaction.
export async function createUser(newUser: NewUser, executor: Executor = db) {
  const {email, password, name, organizationId, role} = newUser;
  const {password: passwords} = await auth.$context;
  const id = randomUUID();
  const hash = await passwords.hash(password);

  const [created] = await executor
    .insert(user)
    .values({
      id,
      email: email.toLowerCase(),
      name,
      role,
      organizationId,
      memberId: newUser.role === 'member' ? newUser.memberId : null,
    })
    .returning();

  if (!created) {
    throw new Error('Insert returned no user');
  }

  await executor.insert(account).values({
    id: randomUUID(),
    userId: id,
    providerId: 'credential',
    accountId: id,
    password: hash,
  });

  return created;
}
