import {gt, sql, type SQL} from 'drizzle-orm';
import type {PgColumn} from 'drizzle-orm/pg-core';

const STOCKHOLM = 'Europe/Stockholm';

type Value<T> = T | PgColumn | SQL<T> | SQL.Aliased<T>;

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function slotStartsAt(
  date: Value<string>,
  slotStart: Value<string>,
): SQL<Date> {
  return sql`(${date}::date + ${slotStart}::time) at time zone ${STOCKHOLM}`;
}

export function slotEndsAt(
  date: Value<string>,
  slotEnd: Value<string>,
  endOffsetDays: Value<number> = 0,
): SQL<Date> {
  return sql`((${date}::date + ${slotEnd}::time) + make_interval(days => ${endOffsetDays})) at time zone ${STOCKHOLM}`;
}

export function slotHasStarted(
  date: Value<string>,
  slotStart: Value<string>,
): SQL<boolean> {
  return sql`${slotStartsAt(date, slotStart)} <= now()`;
}

export function slotHasEnded(
  date: Value<string>,
  slotEnd: Value<string>,
  endOffsetDays: Value<number> = 0,
): SQL<boolean> {
  return sql`${slotEndsAt(date, slotEnd, endOffsetDays)} <= now()`;
}

export function notExpired(endsAt: PgColumn) {
  return gt(endsAt, sql`now()`);
}

export function asIsoText(column: PgColumn): SQL<string> {
  return sql`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
}

export function asDateText(value: PgColumn | SQL | SQL.Aliased): SQL<string> {
  return sql`to_char(${value}, 'YYYY-MM-DD')`;
}

// Today's date where the organizations are.
export function todaySql(): SQL<string> {
  return sql`(now() at time zone ${STOCKHOLM})::date`;
}

export function bookingWindowSql(days: Value<number>) {
  const today = todaySql();

  return {
    today: asDateText(today),
    from: asDateText(today),
    to: asDateText(sql`${today} + make_interval(days => ${days})`),
  };
}

export function formatWhen(date: string, start: string, end: string): string {
  return `${date} ${start}–${end}`;
}
