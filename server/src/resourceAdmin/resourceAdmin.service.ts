import {randomUUID} from 'node:crypto';

import {
  and,
  asc,
  eq,
  gt,
  gte,
  max,
  sql,
  TransactionRollbackError,
} from 'drizzle-orm';

import {announceCancelled} from '../booking/booking.notification.js';
import {
  cancelOrphaned,
  orphanedBookings,
  type Cancelled,
} from '../booking/lifecycle.js';
import {db, type Executor, type Transaction} from '../db/index.js';
import {
  bookings,
  resourceKinds,
  resourceSlots,
  resources,
  subscriptions,
} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {
  assertTranslated,
  localized,
  type LocalizedText,
} from '../lib/locale.js';
import {addDays, asDateText, slotHasStarted, todaySql} from '../lib/time.js';
import type {Organization} from '../lib/user.js';
import type {Notifier} from '../notification/notification.service.js';
import {slotInEffect} from '../resource/schedule.query.js';
import type {
  AdminResources,
  Cancelling,
  ChangePreview,
  CreateKindBody,
  CreateResourceBody,
  ResourceChange,
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

// Today in the organization, as the database tells it.
async function todayIn(executor: Executor, timeZone: string): Promise<string> {
  const {rows} = await executor.execute<{today: string}>(
    sql`select ${asDateText(todaySql(timeZone))} as today`,
  );
  const [row] = rows;

  if (!row) {
    throw new Error('No date from the database');
  }

  return row.today;
}

function assertFrom(day: string, earliest: string) {
  if (day < earliest) {
    throw appError(
      'CHANGE_TOO_EARLY',
      `The change can start on ${earliest} at the earliest`,
    );
  }
}

// Held for the rest of the transaction, so two changes to one resource's
// schedule or closing never interleave, and no apartment books on it
// meanwhile. Answers its name, which the apartments are told.
async function lockResource(
  executor: Executor,
  organizationId: string,
  id: string,
): Promise<{name: LocalizedText}> {
  const [resource] = await executor
    .select({name: resources.name})
    .from(resources)
    .where(
      and(eq(resources.organizationId, organizationId), eq(resources.id, id)),
    )
    .for('update');

  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  return resource;
}

// The names as the admin sees them, for the event log.
export async function nameOfKind(
  {organizationId, locale}: Organization,
  id: string,
): Promise<string> {
  const [kind] = await db
    .select({name: localized(resourceKinds.name, locale)})
    .from(resourceKinds)
    .where(
      and(
        eq(resourceKinds.organizationId, organizationId),
        eq(resourceKinds.id, id),
      ),
    );

  if (!kind) {
    throw appError('NOT_FOUND', 'Unknown kind');
  }

  return kind.name;
}

export async function nameOfResource(
  {organizationId, locale}: Organization,
  id: string,
): Promise<string> {
  const [resource] = await db
    .select({name: localized(resources.name, locale)})
    .from(resources)
    .where(
      and(eq(resources.organizationId, organizationId), eq(resources.id, id)),
    );

  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  return resource.name;
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

export async function listAdminResources({
  organizationId,
  timeZone,
  locale,
}: Organization): Promise<AdminResources> {
  const today = todaySql(timeZone);
  const [now, kinds, rows, slots] = await Promise.all([
    todayIn(db, timeZone),
    db
      .select({
        id: resourceKinds.id,
        name: resourceKinds.name,
        maxActive: resourceKinds.maxActive,
      })
      .from(resourceKinds)
      .where(eq(resourceKinds.organizationId, organizationId))
      .orderBy(asc(localized(resourceKinds.name, locale))),
    db
      .select({
        id: resources.id,
        name: resources.name,
        kindId: resources.kindId,
        tags: resources.tags,
        closesFrom: resources.closesFrom,
        closingNote: resources.closingNote,
        freeFrom: asDateText(sql`greatest(${today}, (
          select max(${bookings.date}) + 1 from ${bookings}
          where ${bookings.resourceId} = ${resources.id}
            and not ${slotHasStarted(timeZone, bookings.date, bookings.start)}
        ))`),
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
          sql`(${slotInEffect(today)} or ${resourceSlots.validFrom} > ${today})`,
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
    today: now,
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

export async function createKind(
  {organizationId, locales}: Organization,
  body: CreateKindBody,
) {
  const id = randomUUID();
  await db.insert(resourceKinds).values({
    id,
    organizationId,
    maxActive: body.maxActive,
    name: assertTranslated(body.name, locales),
  });
  return id;
}

export async function updateKind(
  {organizationId, locales}: Organization,
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
    .set({
      maxActive: body.maxActive,
      name:
        body.name === undefined
          ? undefined
          : assertTranslated(body.name, locales),
    })
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
  {organizationId, timeZone, locales}: Organization,
  body: CreateResourceBody,
) {
  const name = assertTranslated(body.name, locales);
  const tags = assertTranslated(body.tags, locales, {optional: true});
  await assertKind(organizationId, body.kindId);
  assertValidSlots(body.slots);

  const id = randomUUID();
  const today = await todayIn(db, timeZone);

  await db.transaction(async (tx) => {
    const [last] = await tx
      .select({sortOrder: max(resources.sortOrder)})
      .from(resources)
      .where(eq(resources.organizationId, organizationId));

    await tx.insert(resources).values({
      id,
      organizationId,
      kindId: body.kindId,
      name,
      tags,
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
  {organizationId, locales}: Organization,
  id: string,
  body: UpdateResourceBody,
) {
  const name =
    body.name === undefined ? undefined : assertTranslated(body.name, locales);
  const tags =
    body.tags === undefined
      ? undefined
      : assertTranslated(body.tags, locales, {optional: true});
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
  await db
    .update(resources)
    .set({kindId: body.kindId, name, tags})
    .where(eq(resources.id, id));
}

// A night slot ends on the next day, which may be the first of another
// version: it must end before that version's first slot.
async function assertNightsFit(tx: Transaction, id: string, today: string) {
  const later = await tx
    .selectDistinct({validFrom: asDateText(resourceSlots.validFrom)})
    .from(resourceSlots)
    .where(
      and(eq(resourceSlots.resourceId, id), gt(resourceSlots.validFrom, today)),
    );

  for (const {validFrom} of later) {
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
    const starts = await tx
      .select({start: resourceSlots.start})
      .from(resourceSlots)
      .where(
        and(
          eq(resourceSlots.resourceId, id),
          eq(resourceSlots.validFrom, validFrom),
        ),
      );
    const first = Math.min(...starts.map((slot) => minutesOf(slot.start)));

    if (night && minutesOf(night.end) > first) {
      throw appError(
        'INVALID_SCHEDULE',
        'The night slot before the change overlaps its first slot',
      );
    }
  }
}

// Makes the change in the caller's transaction. New times start tomorrow
// at the earliest, so a slot under way today never overlaps one of the
// new; a closing may start today, and its slots that have started stay.
// New times replace every version from their first day on.
async function applyChange(
  tx: Transaction,
  id: string,
  change: ResourceChange,
  today: string,
) {
  switch (change.change) {
    case 'schedule': {
      assertValidSlots(change.slots);
      assertFrom(change.validFrom, addDays(today, 1));

      await tx
        .delete(resourceSlots)
        .where(
          and(
            eq(resourceSlots.resourceId, id),
            gte(resourceSlots.validFrom, change.validFrom),
          ),
        );
      await tx.insert(resourceSlots).values(
        change.slots.map((slot) => ({
          ...slot,
          resourceId: id,
          validFrom: change.validFrom,
        })),
      );
      await assertNightsFit(tx, id, today);
      return;
    }
    case 'removeSchedule': {
      assertFrom(change.validFrom, addDays(today, 1));

      const removed = await tx
        .delete(resourceSlots)
        .where(
          and(
            eq(resourceSlots.resourceId, id),
            eq(resourceSlots.validFrom, change.validFrom),
          ),
        )
        .returning({start: resourceSlots.start});

      if (removed.length === 0) {
        throw appError('NOT_FOUND', 'No schedule starts that day');
      }

      await assertNightsFit(tx, id, today);
      return;
    }
    case 'closing': {
      assertFrom(change.closesFrom, today);

      await tx
        .update(resources)
        .set({closesFrom: change.closesFrom})
        .where(eq(resources.id, id));
    }
  }
}

// The bookings the change would cancel, found by making it and rolling
// it back, so the preview and the change itself never disagree.
export async function previewChange(
  {organizationId, timeZone}: Organization,
  id: string,
  change: ResourceChange,
): Promise<ChangePreview> {
  let found: Cancelled[] = [];

  try {
    await db.transaction(async (tx) => {
      await lockResource(tx, organizationId, id);
      await applyChange(tx, id, change, await todayIn(tx, timeZone));
      found = await orphanedBookings(tx, id, timeZone);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) {
      throw error;
    }
  }

  return {cancels: found.map(({memberId: _, ...booking}) => booking)};
}

// Makes the change and cancels the bookings it leaves without a slot,
// which the admin has seen in the preview and agreed to. Their apartments
// are told once it has committed. Answers what was cancelled, for the
// event log.
export async function changeResource(
  organization: Organization,
  id: string,
  change: ResourceChange,
  {cancels, reason}: Cancelling,
  notifier: Notifier,
): Promise<Cancelled[]> {
  const {organizationId, timeZone, locales} = organization;
  const note = assertTranslated(reason, locales, {optional: true});
  const {name, cancelled} = await db.transaction(async (tx) => {
    const resource = await lockResource(tx, organizationId, id);
    await applyChange(tx, id, change, await todayIn(tx, timeZone));

    // The closed resource says why, to everyone who looks at it.
    if (change.change === 'closing') {
      await tx
        .update(resources)
        .set({closingNote: note})
        .where(eq(resources.id, id));
    }

    return {
      name: resource.name,
      cancelled: await cancelOrphaned(tx, id, timeZone, cancels),
    };
  });

  announceCancelled(notifier, organization, name, cancelled, note);

  return cancelled;
}

// Opening adds days to book and takes none away, so it applies at once.
export async function reopenResource(organizationId: string, id: string) {
  await db.transaction(async (tx) => {
    await lockResource(tx, organizationId, id);

    await tx
      .update(resources)
      .set({closesFrom: null, closingNote: {}})
      .where(eq(resources.id, id));
  });
}

// A resource closed since today or before goes for good, with its times
// and what was booked or queued on it: the closing has cancelled what lay
// ahead, and nothing reads a booking that has ended. The event log keeps
// its name.
export async function removeResource(
  {organizationId, timeZone}: Organization,
  id: string,
) {
  await db.transaction(async (tx) => {
    await lockResource(tx, organizationId, id);
    const today = await todayIn(tx, timeZone);
    const [resource] = await tx
      .select({closesFrom: asDateText(resources.closesFrom)})
      .from(resources)
      .where(eq(resources.id, id));

    if (!resource?.closesFrom || resource.closesFrom > today) {
      throw appError('RESOURCE_OPEN');
    }

    await tx.delete(subscriptions).where(eq(subscriptions.resourceId, id));
    await tx.delete(bookings).where(eq(bookings.resourceId, id));
    await tx.delete(resourceSlots).where(eq(resourceSlots.resourceId, id));
    await tx.delete(resources).where(eq(resources.id, id));
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
