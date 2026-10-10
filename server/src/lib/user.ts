import {and, eq, isNull} from 'drizzle-orm';
import {fromNodeHeaders} from 'better-auth/node';
import type {FastifyRequest} from 'fastify';

import {auth} from '../auth/auth.js';
import {db} from '../db/index.js';
import {members, organizations} from '../db/schema.js';
import {appError} from './errors.js';

// What every request in an organization needs to know about it.
export type Organization = {
  organizationId: string;
  timeZone: string;
};

export type Member = Organization & {
  id: string;
  label: string;
  // The account signed in for the apartment.
  userId: string;
};

export type Admin = Organization;

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
    const [organization] = await db
      .select({timeZone: organizations.timeZone})
      .from(organizations)
      .where(eq(organizations.id, user.organizationId));

    if (!organization) {
      throw new Error(`Unknown organization ${user.organizationId}`);
    }

    return {
      role: 'admin',
      admin: {
        organizationId: user.organizationId,
        timeZone: organization.timeZone,
      },
    };
  }

  if (!user.memberId) {
    throw appError('UNAUTHORIZED', 'Unknown member');
  }

  const [member] = await db
    .select({
      id: members.id,
      organizationId: members.organizationId,
      timeZone: organizations.timeZone,
      label: members.label,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
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

  return {role: 'member', member: {...member, userId: user.id}};
}

export async function getMember(request: FastifyRequest): Promise<Member> {
  const signedIn = await getSignedIn(request);

  if (signedIn.role !== 'member') {
    throw appError('FORBIDDEN', 'Only an apartment can do this');
  }

  return signedIn.member;
}

export async function getAdmin(request: FastifyRequest): Promise<Admin> {
  const signedIn = await getSignedIn(request);

  if (signedIn.role !== 'admin') {
    throw appError('FORBIDDEN', 'Only the admin can do this');
  }

  return signedIn.admin;
}
