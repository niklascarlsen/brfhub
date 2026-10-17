import {describe, expect, test} from 'vitest';

import type {AdminEvent, EventPage} from '../api/types';
import {
  olderFailed,
  receivedNewest,
  receivedOlder,
  startHistory,
} from './useEventHistory';

// Events a minute apart, numbered from the newest.
function event(index: number): AdminEvent {
  return {
    id: `event-${index}`,
    actor: 'admin@example.com',
    actorName: 'Anna',
    action: 'apartment.update',
    subject: String(index),
    at: new Date(2026, 9, 14, 10, 60 - index).toISOString(),
  };
}

function page(from: number, to: number, next = true): EventPage {
  const events = Array.from({length: to - from}, (_, index) =>
    event(from + index),
  );
  return {events, next: next ? (events.at(-1)?.id ?? null) : null};
}

const subjects = (state: {list: {events: AdminEvent[]} | null}) =>
  state.list?.events.map((item) => Number(item.subject));

describe('the history a page at a time', () => {
  test('an older page goes under the list it was asked for', () => {
    const first = page(0, 3);
    const state = {...startHistory(first, ''), loadingOlder: true};

    const next = receivedOlder(state, first, 'event-2', page(3, 5, false));

    expect(subjects(next)).toEqual([0, 1, 2, 3, 4]);
    expect(next.list?.next).toBeNull();
    expect(next.loadingOlder).toBe(false);
  });

  test('an older page answered after the newest loaded anew is put aside', () => {
    const first = page(1, 4);
    const asked = {...startHistory(first, ''), loadingOlder: true};
    const refreshed = receivedNewest(asked, page(0, 3), '');

    expect(refreshed.loadingOlder).toBe(false);
    expect(receivedOlder(refreshed, first, 'event-3', page(4, 6))).toBe(
      refreshed,
    );
    expect(olderFailed(refreshed, first, 'NETWORK')).toBe(refreshed);
  });

  test('another key keeps the list shown until its first page comes', () => {
    const all = startHistory(page(0, 3), '');

    const waiting = receivedNewest(all, null, 'announcements');
    expect(waiting).toBe(all);

    const narrowed = receivedNewest(
      waiting,
      page(1, 2, false),
      'announcements',
    );
    expect(narrowed.key).toBe('announcements');
    // Not merged with the other key's list, though they share an event.
    expect(subjects(narrowed)).toEqual([1]);
  });

  test('back to the first key before the other answered keeps its list', () => {
    const first = page(0, 3);
    const all = receivedOlder(
      {...startHistory(first, ''), loadingOlder: true},
      first,
      'event-2',
      page(3, 6),
    );

    // The load answers the first key with the page it already had.
    expect(receivedNewest(all, first, '')).toBe(all);
    expect(subjects(all)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('a failed older page is told, and the list stays', () => {
    const first = page(0, 3);
    const state = {...startHistory(first, ''), loadingOlder: true};

    const failed = olderFailed(state, first, 'NETWORK');

    expect(failed.olderError).toBe('NETWORK');
    expect(failed.loadingOlder).toBe(false);
    expect(subjects(failed)).toEqual([0, 1, 2]);
  });
});
