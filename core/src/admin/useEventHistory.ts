import {useState} from 'react';

import {codeOf, type ClientErrorCode} from '../api/errors';
import type {EventPage} from '../api/types';
import {withNewest, withOlder, type EventList} from './events';

export type HistoryState = {
  // The newest page the list was last built from, and what it answers for.
  from: EventPage | null;
  key: string;
  list: EventList | null;
  loadingOlder: boolean;
  olderError: ClientErrorCode | null;
};

export function startHistory(
  newest: EventPage | null,
  key: string,
): HistoryState {
  return {
    from: newest,
    key,
    list: newest,
    loadingOlder: false,
    olderError: null,
  };
}

// The newest page as the load answers it for a key. Nothing yet, while
// another key loads, keeps the list shown. Another key's list has nothing
// to keep under the page; the same key's keeps its older pages where it
// can. An older page still out is put aside.
export function receivedNewest(
  state: HistoryState,
  newest: EventPage | null,
  key: string,
): HistoryState {
  if (newest === null || newest === state.from) {
    return state;
  }

  return {
    from: newest,
    key,
    list: key === state.key ? withNewest(state.list, newest) : newest,
    loadingOlder: false,
    olderError: null,
  };
}

// The page after `after`, asked for when the list was built from `from`.
// Counts only while the list is still the one it was asked for under.
export function receivedOlder(
  state: HistoryState,
  from: EventPage | null,
  after: string,
  page: EventPage,
): HistoryState {
  return state.from === from && state.list?.next === after
    ? {...state, list: withOlder(state.list, page), loadingOlder: false}
    : state;
}

export function olderFailed(
  state: HistoryState,
  from: EventPage | null,
  error: ClientErrorCode,
): HistoryState {
  return state.from === from
    ? {...state, loadingOlder: false, olderError: error}
    : state;
}

// The history a page at a time: the newest page as the client's load
// answers it for a key, such as the area it is narrowed to, with the older
// ones the admin asks for under it. While another key loads, the list
// shown stays until its first page comes, so the screen does not empty
// and jump in between, and no older page is asked for meanwhile.
export function useEventHistory(
  newest: EventPage | null,
  key: string,
  loadOlder: (after: string) => Promise<EventPage>,
) {
  const [state, setState] = useState(() => startHistory(newest, key));

  // Derived from the load's answer while rendering, as React allows for
  // state that follows a prop.
  const current = receivedNewest(state, newest, key);
  if (current !== state) {
    setState(current);
  }

  const {from, list} = current;
  const stale = current.key !== key;
  const after = stale ? null : (list?.next ?? null);

  function showOlder() {
    if (after === null || current.loadingOlder) {
      return;
    }

    setState({...current, loadingOlder: true, olderError: null});
    loadOlder(after).then(
      (page) => setState((now) => receivedOlder(now, from, after, page)),
      (caught: unknown) =>
        setState((now) => olderFailed(now, from, codeOf(caught))),
    );
  }

  return {
    events: list?.events ?? null,
    // Whether the list shown answers for another key than the one asked
    // for, until that one's first page comes.
    stale,
    // What the list shown answers for.
    shownKey: current.key,
    hasOlder: after !== null,
    loadingOlder: current.loadingOlder,
    olderError: stale ? null : current.olderError,
    showOlder,
  };
}
