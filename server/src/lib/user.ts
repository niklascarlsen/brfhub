import {and, eq, isNull} from 'drizzle-orm';
import {fromNodeHeaders} from 'better-auth/node';
import type {FastifyRequest} from 'fastify';

import {auth} from '../auth/auth.js';
import {db} from '../db/index.js';
import {members} from '../db/schema.js';
import {appError} from './errors.js';

export type Member = {
  id: string;
  organizationId: string;
  label: string;
};

export type Admin = {
  organizationId: string;
};

export type SignedIn =
  {role: 'member'; member: Member} | {role: 'admin'; admin: Admin};

// The organization always comes from the account, never from the request,
// so nobody can even address another organization's data.
export async function getSignedIn(request: FastifyRequest): Promise<SignedIn> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    throw appError('UNAUTHORIZED');
  }

  const {user} = session;

  if (user.role === 'admin') {
    return {
      role: 'admin',
      admin: {organizationId: user.organizationId},
    };
  }

  if (!user.memberId) {
    throw appError('UNAUTHORIZED', 'Unknown member');
  }

  const [member] = await db
    .select({
      id: members.id,
      organizationId: members.organizationId,
      label: members.label,
    })
    .from(members)
    .where(
      and(
        eq(members.organizationId, user.organizationId),
        eq(members.id, user.memberId),
        isNull(members.leftAt),
      ),
    );

  if (!member) {
    throw appError('UNAUTHORIZED', 'Unknown member');
  }

  return {role: 'member', member};
}

export async function getMember(request: FastifyRequest): Promise<Member> {
  const signedIn = await getSignedIn(request);

  if (signedIn.role !== 'member') {
    throw appError('FORBIDDEN', 'Only an apartment can do this');
  }

  return signedIn.member;
}
