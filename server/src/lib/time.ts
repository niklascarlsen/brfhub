import {sql, type SQL} from 'drizzle-orm';
import type {PgColumn} from 'drizzle-orm/pg-core';

const STOCKHOLM = 'Europe/Stockholm';

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function slotEndsAt(
  date: string,
  slotEnd: string | PgColumn,
): SQL<Date> {
  return sql`(${date}::date + ${slotEnd}::time) at time zone ${STOCKHOLM}`;
}

export function slotHasEnded(
  date: string,
  slotEnd: string | PgColumn,
): SQL<boolean> {
  return sql`${slotEndsAt(date, slotEnd)} <= now()`;
}

export function asIsoText(column: PgColumn): SQL<string> {
  return sql`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
}
