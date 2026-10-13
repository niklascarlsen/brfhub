import {desc, eq, sql} from 'drizzle-orm';
import type {FastifyRequest} from 'fastify';

import {db} from '../db/index.js';
import {adminEvents} from '../db/schema.js';
import type {Admin} from '../lib/user.js';
import type {AdminEvent, EventAction} from './event.dto.js';

// The newest events the admins are shown.
const SHOWN = 100;

// Written once a change is done. Not part of the change's transaction: a
// change that went through is not undone, nor answered as failed, because
// its record could not be written.
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
  } catch (error) {
    request.log.error({err: error, action, subject}, 'event not recorded');
  }
}

export function listEvents(organizationId: string): Promise<AdminEvent[]> {
  return db
    .select({
      id: adminEvents.id,
      actor: adminEvents.actor,
      action: sql<EventAction>`${adminEvents.action}`,
      subject: adminEvents.subject,
      at: sql<string>`to_char(${adminEvents.at} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
    })
    .from(adminEvents)
    .where(eq(adminEvents.organizationId, organizationId))
    .orderBy(desc(adminEvents.at), desc(adminEvents.id))
    .limit(SHOWN);
}
