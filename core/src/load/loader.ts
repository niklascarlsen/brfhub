import {codeOf, type ClientErrorCode} from '../api/errors';

// What a view knows of something it loads from the server: the last answer
// and the identity it answers for, the last failure, and whether a load is
// still out.
export type LoadState<T> = {
  data: T | null;
  key: string | null;
  error: ClientErrorCode | null;
  loading: boolean;
};

export const NOTHING_LOADED: LoadState<never> = {
  data: null,
  key: null,
  error: null,
  loading: false,
};

export type Run<T> = {
  // Which thing the load answers for, such as a date.
  key: string;
  load: () => Promise<T>;
  // A failure that means the answer shown no longer holds, so it goes too.
  // Any other failure keeps it shown.
  forgets?: (code: ClientErrorCode) => boolean;
  // Told the outcome right after onChange, for what follows it outside
  // the view.
  onSettle?: (state: LoadState<T>) => void;
};

export type Loader<T> = {
  run: (run: Run<T>) => void;
  // Outcomes count while listening, from the start. The returned function
  // stops it, so an answer that lands after the view has gone tells
  // nobody.
  listen: () => () => void;
};

// Only the latest run's outcome counts: a slow answer to an earlier run
// never overwrites a newer one, nor its failure a newer answer. Until an
// answer comes, the one before it stays, and a failure stays until the
// next answer.
export function createLoader<T>(
  onChange: (state: LoadState<T>) => void,
): Loader<T> {
  let state: LoadState<T> = NOTHING_LOADED;
  let latest = 0;
  let listening = true;

  function set(next: LoadState<T>) {
    state = next;
    onChange(next);
  }

  return {
    run({key, load, forgets, onSettle}) {
      const run = ++latest;

      function settle(next: () => LoadState<T>) {
        if (run === latest && listening) {
          const settled = next();
          set(settled);
          onSettle?.(settled);
        }
      }

      set({...state, loading: true});

      // A load that throws before it returns a promise fails like any other.
      new Promise<T>((resolve) => resolve(load())).then(
        (data) => settle(() => ({data, key, error: null, loading: false})),
        (caught: unknown) =>
          settle(() => {
            const error = codeOf(caught);

            return forgets?.(error)
              ? {...NOTHING_LOADED, error}
              : {...state, error, loading: false};
          }),
      );
    },
    listen() {
      listening = true;

      return () => {
        listening = false;
      };
    },
  };
}

// The answer for this identity. Another identity's answer is not shown,
// while the same identity's stays until the new one comes.
export function dataFor<T>(state: LoadState<T>, key: string): T | null {
  return state.key === key ? state.data : null;
}

// A screen that loads again, on focus, on return or on retry, hides the
// error it had, and shows it again only if that load fails too.
export function screenError({
  error,
  loading,
}: Pick<LoadState<unknown>, 'error' | 'loading'>): ClientErrorCode | null {
  return loading ? null : error;
}
