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
