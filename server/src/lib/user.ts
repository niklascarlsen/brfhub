import {and, eq, isNull} from 'drizzle-orm';
import {fromNodeHeaders} from 'better-auth/node';
import type {FastifyRequest} from 'fastify';

import {auth} from '../auth/auth.js';
import {db} from '../db/index.js';
import {members, organizations} from '../db/schema.js';
import {appError} from './errors.js';
import {requestedLocales, resolveLocale, type Locale} from './locale.js';

// What every request in an organization needs to know about it.
export type Organization = {
  organizationId: string;
  timeZone: string;
  // The languages the organization writes in.
  locales: Locale[];
  // The one of them this request is answered in: the device's, when the
  // organization writes in it.
  locale: Locale;
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
  const requested = requestedLocales(request.headers['accept-language']);

  if (user.role === 'admin') {
    const [organization] = await db
      .select({
        timeZone: organizations.timeZone,
        locales: organizations.locales,
      })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId));

    if (!organization) {
      throw new Error(`Unknown organization ${user.organizationId}`);
    }

    return {
      role: 'admin',
      admin: {
        organizationId: user.organizationId,
        ...organization,
        locale: resolveLocale(requested, organization.locales),
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
      locales: organizations.locales,
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

  return {
    role: 'member',
    member: {
      ...member,
      locale: resolveLocale(requested, member.locales),
      userId: user.id,
    },
  };
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
