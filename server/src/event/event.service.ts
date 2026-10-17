import {and, desc, eq, gt, inArray, lt, sql} from 'drizzle-orm';
import type {FastifyRequest} from 'fastify';

import {db} from '../db/index.js';
import {adminEvents, user} from '../db/schema.js';
import type {Admin} from '../lib/user.js';
import {
  AREA_OF,
  type EventAction,
  type EventPage,
  type ListEventsQuery,
} from './event.dto.js';

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

// A page of the events still kept, newest first, with the admin's name
// while they are one: from the newest, or from the one after `after`.
// Narrowed to an area, the next page is too. An `after` that is gone or
// another organization's ends the history.
export async function listEvents(
  organizationId: string,
  {area, after, limit}: ListEventsQuery,
): Promise<EventPage> {
  const actions = area
    ? (Object.keys(AREA_OF) as EventAction[]).filter(
        (action) => AREA_OF[action] === area,
      )
    : null;

  const rows = await db
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
        actions ? inArray(adminEvents.action, actions) : undefined,
        // Compared on the stored time, not the milliseconds it is shown
        // with, and the id where two share it.
        after
          ? sql`(${adminEvents.at}, ${adminEvents.id}) < (select ${adminEvents.at}, ${adminEvents.id} from ${adminEvents} where ${adminEvents.id} = ${after} and ${adminEvents.organizationId} = ${organizationId})`
          : undefined,
      ),
    )
    .orderBy(desc(adminEvents.at), desc(adminEvents.id))
    // One more than asked, to know whether there is a next page.
    .limit(limit + 1);

  const events = rows.slice(0, limit);
  return {
    events,
    next: rows.length > limit ? (events.at(-1)?.id ?? null) : null,
  };
}
