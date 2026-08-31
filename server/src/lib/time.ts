import {sql, type SQL} from 'drizzle-orm';
import type {PgColumn} from 'drizzle-orm/pg-core';

const STOCKHOLM = 'Europe/Stockholm';

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function slotStartsAt(
  date: string | PgColumn,
  slotStart: string | PgColumn,
): SQL<Date> {
  return sql`(${date}::date + ${slotStart}::time) at time zone ${STOCKHOLM}`;
}

export function slotEndsAt(
  date: string | PgColumn,
  slotEnd: string | PgColumn,
): SQL<Date> {
  return sql`(${date}::date + ${slotEnd}::time) at time zone ${STOCKHOLM}`;
}

export function slotHasStarted(
  date: string | PgColumn,
  slotStart: string | PgColumn,
): SQL<boolean> {
  return sql`${slotStartsAt(date, slotStart)} <= now()`;
}

export function slotHasEnded(
  date: string | PgColumn,
  slotEnd: string | PgColumn,
): SQL<boolean> {
  return sql`${slotEndsAt(date, slotEnd)} <= now()`;
}

export function asIsoText(column: PgColumn): SQL<string> {
  return sql`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
}

export function bookingWindowSql() {
  const today = sql`(now() at time zone ${STOCKHOLM})::date`;
  const asDate = (value: SQL) => sql`to_char(${value}, 'YYYY-MM-DD')`;

  return {
    today: asDate(today),
    from: asDate(today),
    to: asDate(sql`${today} + interval '1 month'`),
  };
}

export function formatWhen(date: string, start: string, end: string): string {
  return `${date} ${start}–${end}`;
}
