import {and, eq, isNull} from 'drizzle-orm';
import {fromNodeHeaders} from 'better-auth/node';
import type {FastifyRequest} from 'fastify';

import {auth} from '../auth/auth.js';
import {db} from '../db/index.js';
import {members} from '../db/schema.js';
import {appError} from './errors.js';

export const ORGANIZATION_ID = 'demo';

export type Member = {
  id: string;
  organizationId: string;
  label: string;
};

export async function getMember(request: FastifyRequest): Promise<Member> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session?.user.memberId) {
    throw appError('UNAUTHORIZED');
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
        eq(members.organizationId, ORGANIZATION_ID),
        eq(members.id, session.user.memberId),
        isNull(members.leftAt),
      ),
    );

  if (!member) {
    throw appError('UNAUTHORIZED', 'Unknown member');
  }

  return member;
}
