import {describe, expect, test} from 'vitest';

import type {AdminEvent} from '../api/types';
import {en} from '../i18n/en';
import {sv} from '../i18n/sv';
import {describeEvent, eventActor, eventArea, groupEventsByDay} from './events';

function event(at: Date, fields: Partial<AdminEvent> = {}): AdminEvent {
  return {
    id: at.toISOString(),
    actor: 'admin@example.com',
    actorName: 'Anna',
    action: 'apartment.update',
    subject: '12',
    at: at.toISOString(),
    ...fields,
  };
}

// Local times, so the day is the device's whatever zone the tests run in.
const NOW = new Date(2026, 9, 14, 10, 42);

describe('groupEventsByDay', () => {
  test('heads today, yesterday and older days apart', () => {
    const events = [
      event(new Date(2026, 9, 14, 9, 15)),
      event(new Date(2026, 9, 14, 0, 5)),
      event(new Date(2026, 9, 13, 23, 59)),
      event(new Date(2026, 9, 12, 18, 47)),
    ];

    const days = groupEventsByDay(events, sv, NOW);

    expect(days.map((day) => [day.heading, day.events.length])).toEqual([
      ['Idag', 2],
      ['Igår', 1],
      ['Måndag 12 oktober', 1],
    ]);
  });

  test('says the year of a day in another year', () => {
    const days = groupEventsByDay(
      [event(new Date(2025, 11, 30, 12, 0))],
      en,
      NOW,
    );

    expect(days[0]?.heading).toMatch(/December 30 2025$|30 December 2025$/);
  });

  test('yesterday crosses a month', () => {
    const days = groupEventsByDay(
      [event(new Date(2026, 8, 30, 20, 0))],
      sv,
      new Date(2026, 9, 1, 8, 0),
    );

    expect(days[0]?.heading).toBe('Igår');
  });

  test('keeps the order the events come in', () => {
    const first = event(new Date(2026, 9, 14, 9, 0), {id: 'a'});
    const second = event(new Date(2026, 9, 14, 8, 0), {id: 'b'});

    const [today] = groupEventsByDay([first, second], sv, NOW);

    expect(today?.events.map((item) => item.id)).toEqual(['a', 'b']);
  });

  test('is empty without events', () => {
    expect(groupEventsByDay([], sv, NOW)).toEqual([]);
  });
});

test('an event is filed under the area it was made in', () => {
  const at = new Date(2026, 9, 14);

  expect(eventArea(event(at, {action: 'schedule.put'}))).toBe('resources');
  expect(eventArea(event(at, {action: 'kind.remove'}))).toBe('resources');
  expect(eventArea(event(at, {action: 'admin.add'}))).toBe('admins');
  expect(eventArea(event(at, {action: 'organization.update'}))).toBe(
    'organization',
  );
});

test('an admin who is gone is named by address', () => {
  const at = new Date(2026, 9, 14);

  expect(eventActor(event(at))).toBe('Anna');
  expect(eventActor(event(at, {actorName: null}))).toBe('admin@example.com');
});

test('a change to the settings names its parts in the language shown', () => {
  const changed = event(new Date(2026, 9, 14), {
    action: 'organization.update',
    subject: 'name,locales',
  });

  expect(describeEvent(changed, sv)).toBe(
    'Ändrade inställningarna: namnet och språken',
  );
  expect(describeEvent(changed, en)).toBe(
    'Changed the settings: the name and the languages',
  );
  // Written before the parts were keys, in the actor's language.
  expect(
    describeEvent({...changed, subject: 'namnet, bokningsfönstret'}, en),
  ).toBe('Changed the settings: the name and the booking window');
  expect(describeEvent({...changed, subject: 'something else'}, sv)).toBe(
    'Ändrade inställningarna: something else',
  );
});
