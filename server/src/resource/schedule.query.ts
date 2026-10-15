import {sql, type SQL} from 'drizzle-orm';
import type {PgColumn} from 'drizzle-orm/pg-core';

import {resourceSlots, resources} from '../db/schema.js';

type Day = string | PgColumn | SQL | SQL.Aliased;

// The slot belongs to the version of its resource's schedule that is in
// effect on the day. The inner table is aliased so that resource_slots
// still names the outer row.
export function slotInEffect(day: Day): SQL {
  return sql`${resourceSlots.validFrom} = (
    select max(later.valid_from) from ${resourceSlots} as later
    where later.resource_id = ${resourceSlots.resourceId}
      and later.valid_from <= ${day}::date
  )`;
}

export function resourceOpenOn(day: Day): SQL {
  return sql`(${resources.closesFrom} is null or ${day}::date < ${resources.closesFrom})`;
}

// A booked or queued slot the resource no longer offers: the resource is
// closed that day, or the schedule then in effect has no slot of the same
// times. Read in a query of the row's own table, not joined to resources.
export function slotGone(row: {
  resourceId: PgColumn;
  date: PgColumn;
  start: PgColumn;
  end: PgColumn;
}): SQL {
  return sql`(not exists (
      select 1 from ${resources}
      where ${resources.id} = ${row.resourceId} and ${resourceOpenOn(row.date)}
    ) or not exists (
      select 1 from ${resourceSlots}
      where ${resourceSlots.resourceId} = ${row.resourceId}
        and ${resourceSlots.start} = ${row.start}
        and ${resourceSlots.end} = ${row.end}
        and ${slotInEffect(row.date)}
    ))`;
}
