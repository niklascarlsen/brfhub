import {randomUUID} from 'node:crypto';

import {and, asc, eq, gte, max, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {resourceKinds, resourceSlots, resources} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {asDateText, todaySql} from '../lib/time.js';
import {slotInEffect} from '../resource/schedule.query.js';
import {getBookingWindow} from '../slot/slot.service.js';
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

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Everything up to the end of the booking window is promised to members,
// so a change that can touch bookings starts the day after it at the
// earliest.
async function earliestChange(organizationId: string) {
  const window = await getBookingWindow(organizationId);
  return {today: window.today, earliestChange: addDays(window.to, 1)};
}

async function assertAfterWindow(organizationId: string, day: string) {
  const {earliestChange: earliest} = await earliestChange(organizationId);

  if (day < earliest) {
    throw appError(
      'CHANGE_INSIDE_WINDOW',
      `The change can start on ${earliest} at the earliest`,
    );
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
    earliestChange(organizationId),
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
  const {today} = await earliestChange(organizationId);

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

  await db.update(resources).set(body).where(eq(resources.id, id));
}

// Replaces any version that starts after the window, since nobody can
// have booked from it yet.
export async function putSchedule(
  organizationId: string,
  id: string,
  validFrom: string,
  slots: SlotInput[],
) {
  await assertResource(organizationId, id);
  assertValidSlots(slots);
  await assertAfterWindow(organizationId, validFrom);
  const {earliestChange: earliest} = await earliestChange(organizationId);

  await db.transaction(async (tx) => {
    await tx
      .delete(resourceSlots)
      .where(
        and(
          eq(resourceSlots.resourceId, id),
          gte(resourceSlots.validFrom, earliest),
        ),
      );
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
  await assertResource(organizationId, id);
  await assertAfterWindow(organizationId, validFrom);

  const removed = await db
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
}

export async function closeResource(
  organizationId: string,
  id: string,
  closesFrom: string,
) {
  await assertResource(organizationId, id);
  await assertAfterWindow(organizationId, closesFrom);

  await db.update(resources).set({closesFrom}).where(eq(resources.id, id));
}

// Opening adds days to book and takes none away, so it applies at once.
export async function reopenResource(organizationId: string, id: string) {
  await assertResource(organizationId, id);

  await db
    .update(resources)
    .set({closesFrom: null})
    .where(eq(resources.id, id));
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
