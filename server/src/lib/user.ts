import {and, eq, isNull} from 'drizzle-orm';
import {fromNodeHeaders} from 'better-auth/node';
import type {FastifyRequest} from 'fastify';

import {auth} from '../auth/auth.js';
import {adminSessionExpired} from '../auth/sessions.js';
import {db} from '../db/index.js';
import {
  members,
  organizations,
  session as sessions,
  user as users,
} from '../db/schema.js';
import {appError} from './errors.js';
import {
  requestedLocale,
  requestedLocales,
  resolveLocale,
  type Locale,
} from './locale.js';

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
  // The sign-in, which the device's push token goes with.
  sessionId: string;
};

export type Admin = Organization & {
  userId: string;
  // The address at the time, which the event log names the admin by.
  email: string;
  twoFactorEnabled: boolean;
};

// An account is a resident's, an admin's, or both.
export type SignedIn = {
  userId: string;
  member: Member | null;
  admin: Admin | null;
};

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

  // Better Auth's own routes refuse it from the hook in auth.ts; ours do
  // it here, so neither depends on the other.
  if (user.admin && adminSessionExpired(session.session.createdAt)) {
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

  // Remembered for the mail the account is sent later, outside any
  // request. A request that asks for no language the organization writes
  // in, such as a script's, leaves it as it was.
  const shown = requestedLocale(requested, organization.locales);
  if (shown !== null && shown !== user.locale) {
    await db.update(users).set({locale: shown}).where(eq(users.id, user.id));
  }
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

  const member = apartment
    ? {...common, ...apartment, userId: user.id, sessionId: session.session.id}
    : null;
  const admin = user.admin
    ? {
        ...common,
        userId: user.id,
        email: user.email,
        // Better Auth types the plugin's field as optional.
        twoFactorEnabled: user.twoFactorEnabled === true,
      }
    : null;

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

// Everything an admin does, beyond reading who they are, waits until an
// authenticator is set up.
export async function getAdmin(request: FastifyRequest): Promise<Admin> {
  const {admin} = await getSignedIn(request);

  if (admin === null) {
    throw appError('FORBIDDEN', 'Only an admin can do this');
  }

  if (!admin.twoFactorEnabled) {
    throw appError('TWO_FACTOR_REQUIRED');
  }

  return admin;
}
