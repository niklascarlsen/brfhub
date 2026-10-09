import {randomUUID} from 'node:crypto';

import {and, asc, eq, gte, max, sql} from 'drizzle-orm';

import {db, type Executor} from '../db/index.js';
import {
  bookings,
  organizations,
  resourceKinds,
  resourceSlots,
  resources,
  subscriptions,
} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {asDateText, todaySql} from '../lib/time.js';
import {slotInEffect} from '../resource/schedule.query.js';
import type {
  AdminResources,
  CreateKindBody,
  CreateResourceBody,
  SlotInput,
  UpdateKindBody,
  UpdateResourceBody,
} from './resourceAdmin.dto.js';

const DAY_MINUTES = 24 * 60;

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// One day's slots must follow each other without overlapping. Only the last
// may run past midnight, and then not into the first slot of the next day.
export function assertValidSlots(slots: SlotInput[]): void {
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  const spans = sorted.map((slot) => {
    const start = minutesOf(slot.start);
    const end = minutesOf(slot.end) + slot.endOffsetDays * DAY_MINUTES;
    return {start, end};
  });

  for (const [index, span] of spans.entries()) {
    if (span.end <= span.start || span.end - span.start > DAY_MINUTES) {
      throw appError(
        'INVALID_SCHEDULE',
        `The slot at ${sorted[index]?.start} ends before it starts`,
      );
    }

    const next = spans[index + 1] ?? {
      start: (spans[0]?.start ?? 0) + DAY_MINUTES,
    };

    if (span.end > next.start) {
      throw appError(
        'INVALID_SCHEDULE',
        `The slot at ${sorted[index]?.start} overlaps the next one`,
      );
    }
  }
}

// Everything up to the end of the booking window is promised to members,
// and so is any later day booked or watched before the window was made
// shorter. A change that can touch bookings starts the day after all of
// them at the earliest.
async function changeDates(executor: Executor, organizationId: string) {
  const today = todaySql();
  const promised = sql`greatest(
    ${today} + make_interval(days => ${organizations.bookingWindowDays}),
    (select max(${bookings.date}) from ${bookings}
      where ${bookings.organizationId} = ${organizationId}),
    (select max(${subscriptions.date}) from ${subscriptions}
      where ${subscriptions.organizationId} = ${organizationId})
  )`;

  const [row] = await executor
    .select({
      today: asDateText(today),
      earliestChange: asDateText(sql`${promised} + interval '1 day'`),
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!row) {
    throw new Error(`Unknown organization ${organizationId}`);
  }

  return row;
}

function assertFrom(day: string, earliest: string) {
  if (day < earliest) {
    throw appError(
      'CHANGE_INSIDE_WINDOW',
      `The change can start on ${earliest} at the earliest`,
    );
  }
}

// Held for the rest of the transaction, so two changes to one resource's
// schedule or closing never interleave.
async function lockResource(
  executor: Executor,
  organizationId: string,
  id: string,
) {
  const [resource] = await executor
    .select({id: resources.id})
    .from(resources)
    .where(
      and(eq(resources.organizationId, organizationId), eq(resources.id, id)),
    )
    .for('update');

  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }
}

async function assertKind(organizationId: string, kindId: string) {
  const [kind] = await db
    .select({id: resourceKinds.id})
    .from(resourceKinds)
    .where(
      and(
        eq(resourceKinds.organizationId, organizationId),
        eq(resourceKinds.id, kindId),
      ),
    );

  if (!kind) {
    throw appError('NOT_FOUND', 'Unknown kind');
  }
}

async function assertResource(organizationId: string, id: string) {
  const [resource] = await db
    .select({id: resources.id})
    .from(resources)
    .where(
      and(eq(resources.organizationId, organizationId), eq(resources.id, id)),
    );

  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }
}

export async function listAdminResources(
  organizationId: string,
): Promise<AdminResources> {
  const [dates, kinds, rows, slots] = await Promise.all([
    changeDates(db, organizationId),
    db
      .select({
        id: resourceKinds.id,
        name: resourceKinds.name,
        maxActive: resourceKinds.maxActive,
      })
      .from(resourceKinds)
      .where(eq(resourceKinds.organizationId, organizationId))
      .orderBy(asc(resourceKinds.name)),
    db
      .select({
        id: resources.id,
        name: resources.name,
        kindId: resources.kindId,
        tags: resources.tags,
        closesFrom: resources.closesFrom,
      })
      .from(resources)
      .where(eq(resources.organizationId, organizationId))
      .orderBy(asc(resources.sortOrder)),
    db
      .select({
        resourceId: resourceSlots.resourceId,
        validFrom: asDateText(resourceSlots.validFrom),
        start: resourceSlots.start,
        end: resourceSlots.end,
        endOffsetDays: resourceSlots.endOffsetDays,
      })
      .from(resourceSlots)
      .innerJoin(resources, eq(resources.id, resourceSlots.resourceId))
      .where(
        and(
          eq(resources.organizationId, organizationId),
          sql`(${slotInEffect(todaySql())} or ${resourceSlots.validFrom} > ${todaySql()})`,
        ),
      )
      .orderBy(asc(resourceSlots.validFrom), asc(resourceSlots.start)),
  ]);

  // Kinds in the order of their first resource, as members see them, and
  // kinds without resources last.
  const firstIndex = (kindId: string) => {
    const index = rows.findIndex((resource) => resource.kindId === kindId);
    return index === -1 ? rows.length : index;
  };

  return {
    ...dates,
    kinds: [...kinds].sort((a, b) => firstIndex(a.id) - firstIndex(b.id)),
    resources: rows.map((resource) => {
      const schedules: AdminResources['resources'][number]['schedules'] = [];

      for (const slot of slots) {
        if (slot.resourceId !== resource.id) {
          continue;
        }

        const {validFrom, start, end} = slot;
        const endOffsetDays = slot.endOffsetDays === 1 ? 1 : 0;
        const last = schedules.at(-1);

        if (last?.validFrom === validFrom) {
          last.slots.push({start, end, endOffsetDays});
        } else {
          schedules.push({validFrom, slots: [{start, end, endOffsetDays}]});
        }
      }

      return {...resource, schedules};
    }),
  };
}

export async function createKind(organizationId: string, body: CreateKindBody) {
  const id = randomUUID();
  await db.insert(resourceKinds).values({id, organizationId, ...body});
  return id;
}

export async function updateKind(
  organizationId: string,
  id: string,
  body: UpdateKindBody,
) {
  await assertKind(organizationId, id);

  if (body.name === undefined && body.maxActive === undefined) {
    return;
  }

  // A lower limit applies to new bookings; the ones already made stand.
  await db
    .update(resourceKinds)
    .set(body)
    .where(
      and(
        eq(resourceKinds.organizationId, organizationId),
        eq(resourceKinds.id, id),
      ),
    );
}

export async function deleteKind(organizationId: string, id: string) {
  await assertKind(organizationId, id);

  const [used] = await db
    .select({id: resources.id})
    .from(resources)
    .where(
      and(
        eq(resources.organizationId, organizationId),
        eq(resources.kindId, id),
      ),
    )
    .limit(1);

  if (used) {
    throw appError('KIND_IN_USE');
  }

  await db
    .delete(resourceKinds)
    .where(
      and(
        eq(resourceKinds.organizationId, organizationId),
        eq(resourceKinds.id, id),
      ),
    );
}

// A new resource has no bookings to break, so its schedule starts today.
export async function createResource(
  organizationId: string,
  body: CreateResourceBody,
) {
  await assertKind(organizationId, body.kindId);
  assertValidSlots(body.slots);

  const id = randomUUID();
  const {today} = await changeDates(db, organizationId);

  await db.transaction(async (tx) => {
    const [last] = await tx
      .select({sortOrder: max(resources.sortOrder)})
      .from(resources)
      .where(eq(resources.organizationId, organizationId));

    await tx.insert(resources).values({
      id,
      organizationId,
      kindId: body.kindId,
      name: body.name,
      tags: body.tags,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    });
    await tx
      .insert(resourceSlots)
      .values(
        body.slots.map((slot) => ({...slot, resourceId: id, validFrom: today})),
      );
  });

  return id;
}

export async function updateResource(
  organizationId: string,
  id: string,
  body: UpdateResourceBody,
) {
  await assertResource(organizationId, id);

  if (body.kindId !== undefined) {
    await assertKind(organizationId, body.kindId);
  }

  if (
    body.name === undefined &&
    body.kindId === undefined &&
    body.tags === undefined
  ) {
    return;
  }

  // Like a lower limit, a new kind's limit applies to new bookings; the
  // ones already made stand.
  await db.update(resources).set(body).where(eq(resources.id, id));
}

// Replaces any version not yet promised, since nobody can have booked
// from it yet.
export async function putSchedule(
  organizationId: string,
  id: string,
  validFrom: string,
  slots: SlotInput[],
) {
  assertValidSlots(slots);

  await db.transaction(async (tx) => {
    await lockResource(tx, organizationId, id);
    const {earliestChange: earliest} = await changeDates(tx, organizationId);
    assertFrom(validFrom, earliest);

    await tx
      .delete(resourceSlots)
      .where(
        and(
          eq(resourceSlots.resourceId, id),
          gte(resourceSlots.validFrom, earliest),
        ),
      );

    // The night slot of the day before may run into the new first slot.
    const [night] = await tx
      .select({end: resourceSlots.end})
      .from(resourceSlots)
      .where(
        and(
          eq(resourceSlots.resourceId, id),
          eq(resourceSlots.endOffsetDays, 1),
          slotInEffect(sql`(${validFrom}::date - 1)`),
        ),
      );
    const first = Math.min(...slots.map((slot) => minutesOf(slot.start)));

    if (night && minutesOf(night.end) > first) {
      throw appError(
        'INVALID_SCHEDULE',
        'The night slot before the change overlaps its first slot',
      );
    }

    await tx
      .insert(resourceSlots)
      .values(slots.map((slot) => ({...slot, resourceId: id, validFrom})));
  });
}

export async function deleteSchedule(
  organizationId: string,
  id: string,
  validFrom: string,
) {
  await db.transaction(async (tx) => {
    await lockResource(tx, organizationId, id);
    const {earliestChange: earliest} = await changeDates(tx, organizationId);
    assertFrom(validFrom, earliest);

    const removed = await tx
      .delete(resourceSlots)
      .where(
        and(
          eq(resourceSlots.resourceId, id),
          eq(resourceSlots.validFrom, validFrom),
        ),
      )
      .returning({start: resourceSlots.start});

    if (removed.length === 0) {
      throw appError('NOT_FOUND', 'No schedule starts that day');
    }
  });
}

export async function closeResource(
  organizationId: string,
  id: string,
  closesFrom: string,
) {
  await db.transaction(async (tx) => {
    await lockResource(tx, organizationId, id);
    const {earliestChange: earliest} = await changeDates(tx, organizationId);
    assertFrom(closesFrom, earliest);

    await tx.update(resources).set({closesFrom}).where(eq(resources.id, id));
  });
}

// Opening adds days to book and takes none away, so it applies at once.
export async function reopenResource(organizationId: string, id: string) {
  await db.transaction(async (tx) => {
    await lockResource(tx, organizationId, id);

    await tx
      .update(resources)
      .set({closesFrom: null})
      .where(eq(resources.id, id));
  });
}

export async function orderResources(organizationId: string, ids: string[]) {
  const own = await db
    .select({id: resources.id})
    .from(resources)
    .where(eq(resources.organizationId, organizationId));

  const known = new Set(own.map((row) => row.id));

  if (
    ids.length !== known.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !known.has(id))
  ) {
    throw appError('VALIDATION', 'The order must list every resource once');
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(resources)
        .set({sortOrder: index + 1})
        .where(eq(resources.id, id));
    }
  });
}
