import {and, eq, isNull} from 'drizzle-orm';
import type {FastifyRequest} from 'fastify';

import {db} from '../db/index.js';
import {members} from '../db/schema.js';
import {appError} from './errors.js';

export const ORGANIZATION_ID = 'demo';

export type Member = {
  id: string;
  organizationId: string;
};

export async function getMember(request: FastifyRequest): Promise<Member> {
  const header = request.headers['x-apartment-number'];

  if (typeof header !== 'string' || header.length === 0) {
    throw appError('UNAUTHORIZED', 'Missing apartment number');
  }

  const [member] = await db
    .select({id: members.id, organizationId: members.organizationId})
    .from(members)
    .where(
      and(
        eq(members.organizationId, ORGANIZATION_ID),
        eq(members.label, header),
        isNull(members.leftAt),
      ),
    );

  if (!member) {
    throw appError('UNAUTHORIZED', 'Unknown member');
  }

  return member;
}
