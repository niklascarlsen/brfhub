import {and, eq, isNull} from 'drizzle-orm';
import {fromNodeHeaders} from 'better-auth/node';
import type {FastifyRequest} from 'fastify';

import {ADMIN_SESSION_DAYS, auth} from '../auth/auth.js';
import {db} from '../db/index.js';
import {members, organizations, session as sessions} from '../db/schema.js';
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

// An account is a resident's, an admin's, or both.
export type SignedIn = {
  userId: string;
  member: Member | null;
  admin: Admin | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

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

  // An admin's session ends a week after sign-in however much it is used:
  // Better Auth keeps extending a used one. Only this session: the admin's
  // other devices signed in on their own days.
  if (
    user.admin &&
    session.session.createdAt.getTime() + ADMIN_SESSION_DAYS * DAY_MS <
      Date.now()
  ) {
    await db.delete(sessions).where(eq(sessions.id, session.session.id));
    throw appError('UNAUTHORIZED', 'Session expired');
  }

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

  const requested = requestedLocales(request.headers['accept-language']);
  const common: Organization = {
    organizationId: user.organizationId,
    ...organization,
    locale: resolveLocale(requested, organization.locales),
  };

  const [apartment] = user.memberId
    ? await db
        .select({id: members.id, label: members.label})
        .from(members)
        .where(
          and(
            eq(members.organizationId, user.organizationId),
            eq(members.id, user.memberId),
            isNull(members.leftAt),
          ),
        )
    : [];

  const member = apartment ? {...common, ...apartment, userId: user.id} : null;
  const admin = user.admin ? common : null;

  // Moved out and not an admin: the session is live, but there is nothing
  // the account may do.
  if (member === null && admin === null) {
    throw appError('UNAUTHORIZED', 'Unknown member');
  }

  return {userId: user.id, member, admin};
}

export async function getMember(request: FastifyRequest): Promise<Member> {
  const {member} = await getSignedIn(request);

  if (member === null) {
    throw appError('FORBIDDEN', 'Only an apartment can do this');
  }

  return member;
}

export async function getAdmin(request: FastifyRequest): Promise<Admin> {
  const {admin} = await getSignedIn(request);

  if (admin === null) {
    throw appError('FORBIDDEN', 'Only an admin can do this');
  }

  return admin;
}
