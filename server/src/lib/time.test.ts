import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {sql, type SQL} from 'drizzle-orm';

import {db, pool} from '../db/index.js';
import {assertTestDatabase} from '../test/fixtures.js';
import {
  addDays,
  asDateText,
  isoDateIn,
  isValidTimeZone,
  slotEndsAt,
  slotStartsAt,
  todaySql,
} from './time.js';

const STOCKHOLM = 'Europe/Stockholm';
const NEW_YORK = 'America/New_York';
// UTC+14 and UTC-11 all year: their dates never agree.
const KIRITIMATI = 'Pacific/Kiritimati';
const PAGO_PAGO = 'Pacific/Pago_Pago';

async function utc(instant: SQL<Date>): Promise<string> {
  const {rows} = await db.execute<{at: string}>(
    sql`select to_char(${instant} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') as at`,
  );

  return rows[0]?.at ?? '';
}

before(assertTestDatabase);

after(async () => {
  await pool.end();
});

test('a slot starts at its wall-clock time on either side of a DST change', async () => {
  const cases = [
    // Stockholm springs forward on 29 March and falls back on 25 October.
    [STOCKHOLM, '2026-03-28', '2026-03-28T06:00Z'],
    [STOCKHOLM, '2026-03-30', '2026-03-30T05:00Z'],
    [STOCKHOLM, '2026-10-24', '2026-10-24T05:00Z'],
    [STOCKHOLM, '2026-10-26', '2026-10-26T06:00Z'],
    [NEW_YORK, '2026-10-10', '2026-10-10T11:00Z'],
    [NEW_YORK, '2026-11-02', '2026-11-02T12:00Z'],
  ] as const;

  for (const [zone, date, expected] of cases) {
    assert.equal(
      await utc(slotStartsAt(zone, date, '07:00')),
      expected,
      `${zone} ${date}`,
    );
  }
});

test('a night slot ends on the next day in that day’s offset', async () => {
  // 20:00 on the Saturday until 08:00 on the Sunday the clocks go back.
  assert.equal(
    await utc(slotEndsAt(STOCKHOLM, '2026-10-24', '08:00', 1)),
    '2026-10-25T07:00Z',
  );
});

test('today is the date in the organization’s zone', async () => {
  for (const zone of [STOCKHOLM, NEW_YORK, KIRITIMATI, PAGO_PAGO]) {
    const earlier = isoDateIn(zone);
    const {rows} = await db.execute<{today: string}>(
      sql`select ${asDateText(todaySql(zone))} as today`,
    );
    const later = isoDateIn(zone);

    // Midnight may pass between the two clocks.
    assert.ok(
      [earlier, later].includes(rows[0]?.today ?? ''),
      `${zone}: ${rows[0]?.today} is neither ${earlier} nor ${later}`,
    );
  }
});

test('the date in a zone follows its offset, not the server’s', () => {
  const noon = new Date('2026-10-10T12:00:00Z');
  const morning = new Date('2026-10-10T10:30:00Z');

  assert.equal(isoDateIn(KIRITIMATI, noon), '2026-10-11');
  assert.equal(isoDateIn(PAGO_PAGO, noon), '2026-10-10');
  assert.equal(isoDateIn(PAGO_PAGO, morning), '2026-10-09');
});

test('days are added across months, years and DST changes', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-25', -1), '2026-10-24');
});

test('only zones Postgres knows are valid', async () => {
  assert.equal(await isValidTimeZone(STOCKHOLM), true);
  assert.equal(await isValidTimeZone(PAGO_PAGO), true);
  assert.equal(await isValidTimeZone('Mars/Olympus_Mons'), false);
  assert.equal(await isValidTimeZone(''), false);
});
