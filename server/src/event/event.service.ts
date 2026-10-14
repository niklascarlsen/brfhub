import {and, desc, eq, gt, lt, sql} from 'drizzle-orm';
import type {FastifyRequest} from 'fastify';

import {db} from '../db/index.js';
import {adminEvents, user} from '../db/schema.js';
import type {Admin} from '../lib/user.js';
import type {AdminEvent, EventAction} from './event.dto.js';

// How long an event is kept: a board's year, so the next board sees what
// the last one did. Each event names an admin by address, which should not
// outlive them by much more.
const KEPT = sql`interval '12 months'`;

// Written once a change is done. Not part of the change's transaction: a
// change that went through is not undone, nor answered as failed, because
// its record could not be written. Writing one also clears the
// organization's events that are past keeping.
export async function logEvent(
  request: FastifyRequest,
  admin: Admin,
  action: EventAction,
  subject: string,
): Promise<void> {
  try {
    await db.insert(adminEvents).values({
      organizationId: admin.organizationId,
      actor: admin.email,
      action,
      subject,
    });
    await db
      .delete(adminEvents)
      .where(
        and(
          eq(adminEvents.organizationId, admin.organizationId),
          lt(adminEvents.at, sql`now() - ${KEPT}`),
        ),
      );
  } catch (error) {
    request.log.error({err: error, action, subject}, 'event not recorded');
  }
}

// Every event still kept, newest first, with the admin's name while they
// are one.
export function listEvents(organizationId: string): Promise<AdminEvent[]> {
  return db
    .select({
      id: adminEvents.id,
      actor: adminEvents.actor,
      actorName: user.name,
      action: sql<EventAction>`${adminEvents.action}`,
      subject: adminEvents.subject,
      at: sql<string>`to_char(${adminEvents.at} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
    })
    .from(adminEvents)
    .leftJoin(
      user,
      and(
        eq(user.email, adminEvents.actor),
        eq(user.organizationId, adminEvents.organizationId),
        user.admin,
      ),
    )
    .where(
      and(
        eq(adminEvents.organizationId, organizationId),
        gt(adminEvents.at, sql`now() - ${KEPT}`),
      ),
    )
    .orderBy(desc(adminEvents.at), desc(adminEvents.id));
}
