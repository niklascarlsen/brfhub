import {gt, sql, type SQL} from 'drizzle-orm';
import type {PgColumn} from 'drizzle-orm/pg-core';

import {db} from '../db/index.js';
import {INTL_LOCALES, type Locale} from './locale.js';

// Dates and slot times are wall-clock values in the organization's time
// zone, which every helper here takes first: an IANA name or the
// organizations.time_zone column.
type Value<T> = T | PgColumn | SQL<T> | SQL.Aliased<T>;

// Postgres does the arithmetic, so it decides which names are valid.
export async function isValidTimeZone(name: string): Promise<boolean> {
  const {rows} = await db.execute<{valid: boolean}>(
    sql`select exists(select 1 from pg_timezone_names where name = ${name}) as valid`,
  );

  return rows[0]?.valid ?? false;
}

// The date it is in the zone at that instant, for scripts and tests that
// need today's date without asking the database.
export function isoDateIn(timeZone: string, at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The moment the statement runs. Postgres's now() is when the transaction
// began, which for one that waited on a lock can be before a slot it then
// judges had started.
export function currentTime(): SQL<Date> {
  return sql`statement_timestamp()`;
}

export function slotStartsAt(
  timeZone: Value<string>,
  date: Value<string>,
  slotStart: Value<string>,
): SQL<Date> {
  return sql`(${date}::date + ${slotStart}::time) at time zone ${timeZone}`;
}

export function slotEndsAt(
  timeZone: Value<string>,
  date: Value<string>,
  slotEnd: Value<string>,
  endOffsetDays: Value<number> = 0,
): SQL<Date> {
  return sql`((${date}::date + ${slotEnd}::time) + make_interval(days => ${endOffsetDays})) at time zone ${timeZone}`;
}

export function slotHasStarted(
  timeZone: Value<string>,
  date: Value<string>,
  slotStart: Value<string>,
): SQL<boolean> {
  return sql`${slotStartsAt(timeZone, date, slotStart)} <= ${currentTime()}`;
}

export function slotHasEnded(
  timeZone: Value<string>,
  date: Value<string>,
  slotEnd: Value<string>,
  endOffsetDays: Value<number> = 0,
): SQL<boolean> {
  return sql`${slotEndsAt(timeZone, date, slotEnd, endOffsetDays)} <= ${currentTime()}`;
}

export function notExpired(endsAt: PgColumn) {
  return gt(endsAt, currentTime());
}

export function asIsoText(column: PgColumn): SQL<string> {
  return sql`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
}

export function asDateText(value: PgColumn | SQL | SQL.Aliased): SQL<string> {
  return sql`to_char(${value}, 'YYYY-MM-DD')`;
}

// Today's date in the organization.
export function todaySql(timeZone: Value<string>): SQL<string> {
  return sql`(${currentTime()} at time zone ${timeZone})::date`;
}

export function bookingWindowSql(timeZone: Value<string>, days: Value<number>) {
  const today = todaySql(timeZone);

  return {
    today: asDateText(today),
    from: asDateText(today),
    to: asDateText(sql`${today} + make_interval(days => ${days})`),
  };
}

// "lördag 10 oktober 07:00–10:00". The date is a calendar day, so it is
// written in UTC whatever zone the server runs in.
export function formatWhen(
  locale: Locale,
  date: string,
  start: string,
  end: string,
): string {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString(
    INTL_LOCALES[locale],
    {timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long'},
  );

  return `${day} ${start}–${end}`;
}
