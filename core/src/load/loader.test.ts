import {describe, expect, test} from 'vitest';

import {apiError} from '../api/errors';
import {
  createLoader,
  dataFor,
  NOTHING_LOADED,
  screenError,
  type LoadState,
} from './loader';

// A load the test answers or fails when it chooses.
function pending<T>() {
  let answer!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    answer = resolve;
    fail = reject;
  });

  return {load: () => promise, answer, fail};
}

function setup(forgets?: (code: string) => boolean) {
  const changes: LoadState<string>[] = [];
  const settled: LoadState<string>[] = [];
  const loader = createLoader<string>((state) => changes.push(state));

  return {
    run: (key: string, load: () => Promise<string>) =>
      loader.run({
        key,
        load,
        forgets,
        onSettle: (state) => settled.push(state),
      }),
    listen: () => loader.listen(),
    changes,
    settled,
    state: () => changes.at(-1) ?? NOTHING_LOADED,
  };
}

// Lets the promise callbacks run.
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('createLoader', () => {
  test('is loading until the answer comes, then holds it', async () => {
    const {run, state} = setup();
    const first = pending<string>();

    run('', first.load);
    expect(state()).toEqual({...NOTHING_LOADED, loading: true});

    first.answer('rooms');
    await settle();
    expect(state()).toEqual({
      data: 'rooms',
      key: '',
      error: null,
      loading: false,
    });
  });

  test('keeps the last answer shown while the next one loads', async () => {
    const {run, state} = setup();
    run('', async () => 'old');
    await settle();

    const next = pending<string>();
    run('', next.load);
    expect(state()).toMatchObject({data: 'old', loading: true});

    next.answer('new');
    await settle();
    expect(state()).toMatchObject({data: 'new', loading: false});
  });

  test('never lets an earlier answer overwrite a later one', async () => {
    const {run, state, changes} = setup();
    const slow = pending<string>();
    const fast = pending<string>();

    run('monday', slow.load);
    run('tuesday', fast.load);
    fast.answer('tuesday slots');
    await settle();
    const seen = changes.length;

    slow.answer('monday slots');
    await settle();
    expect(changes).toHaveLength(seen);
    expect(state()).toMatchObject({key: 'tuesday', data: 'tuesday slots'});
  });

  test('ignores an earlier failure once a later run is out', async () => {
    const {run, state} = setup();
    const slow = pending<string>();
    const fast = pending<string>();

    run('', slow.load);
    run('', fast.load);
    slow.fail(apiError('NETWORK'));
    await settle();
    expect(state()).toMatchObject({error: null, loading: true});

    fast.answer('rooms');
    await settle();
    expect(state()).toMatchObject({data: 'rooms', error: null});
  });

  test('tells onSettle only the outcome of the latest run', async () => {
    const {run, settled} = setup();
    const slow = pending<string>();
    const fast = pending<string>();

    run('', slow.load);
    run('', fast.load);
    expect(settled).toEqual([]);

    slow.answer('stale');
    fast.fail(apiError('NETWORK'));
    await settle();
    expect(settled).toEqual([{...NOTHING_LOADED, error: 'NETWORK'}]);
  });

  test('stays loading while only an earlier run has answered', async () => {
    const {run, state} = setup();
    const slow = pending<string>();
    const fast = pending<string>();

    run('', slow.load);
    run('', fast.load);
    slow.answer('stale');
    await settle();
    expect(state()).toEqual({...NOTHING_LOADED, loading: true});
  });

  test('keeps the answer shown and the error until the next answer', async () => {
    const {run, state} = setup();
    run('', async () => 'rooms');
    await settle();

    run('', () => Promise.reject(apiError('NETWORK')));
    await settle();
    expect(state()).toEqual({
      data: 'rooms',
      key: '',
      error: 'NETWORK',
      loading: false,
    });

    const retry = pending<string>();
    run('', retry.load);
    expect(state()).toMatchObject({error: 'NETWORK', loading: true});

    retry.answer('rooms again');
    await settle();
    expect(state()).toMatchObject({data: 'rooms again', error: null});
  });

  test('reads a failure it does not know as UNKNOWN', async () => {
    const {run, state} = setup();
    run('', () => Promise.reject(new Error('boom')));
    await settle();
    expect(state().error).toBe('UNKNOWN');
  });

  test('fails a load that throws before returning a promise', async () => {
    const {run, state} = setup();
    run('', () => {
      throw apiError('TIMEOUT');
    });
    await settle();
    expect(state()).toMatchObject({error: 'TIMEOUT', loading: false});
  });

  test('an answer after it stopped listening tells nobody', async () => {
    const {run, listen, changes, settled} = setup();
    const first = pending<string>();
    const stop = listen();

    run('', first.load);
    stop();
    first.answer('rooms');
    await settle();

    expect(changes).toEqual([{...NOTHING_LOADED, loading: true}]);
    expect(settled).toEqual([]);
  });

  test('listening again, as a remount does, counts outcomes again', async () => {
    const {run, listen, state} = setup();
    const first = pending<string>();

    listen()();
    listen();
    run('', first.load);
    first.answer('rooms');
    await settle();

    expect(state().data).toBe('rooms');
  });

  test('drops the answer on a failure that means it no longer holds', async () => {
    const {run, state} = setup((code) => code === 'UNAUTHORIZED');
    run('', async () => 'apartment 12');
    await settle();

    run('', () => Promise.reject(apiError('NETWORK')));
    await settle();
    expect(state().data).toBe('apartment 12');

    run('', () => Promise.reject(apiError('UNAUTHORIZED')));
    await settle();
    expect(state()).toEqual({...NOTHING_LOADED, error: 'UNAUTHORIZED'});

    // A later failure of another kind does not bring it back.
    run('', () => Promise.reject(apiError('NETWORK')));
    await settle();
    expect(state()).toEqual({...NOTHING_LOADED, error: 'NETWORK'});
  });
});

describe('dataFor', () => {
  const loaded: LoadState<string> = {
    data: 'monday slots',
    key: 'monday',
    error: null,
    loading: true,
  };

  test('shows the answer for the same identity', () => {
    expect(dataFor(loaded, 'monday')).toBe('monday slots');
  });

  test('hides the answer for another identity', () => {
    expect(dataFor(loaded, 'tuesday')).toBeNull();
  });

  test('shows nothing before any answer', () => {
    expect(dataFor(NOTHING_LOADED, '')).toBeNull();
  });
});

describe('screenError', () => {
  test('shows the error once the load has failed', () => {
    expect(screenError({error: 'NETWORK', loading: false})).toBe('NETWORK');
  });

  test('hides the error while a new load runs', () => {
    expect(screenError({error: 'NETWORK', loading: true})).toBeNull();
  });

  test('shows nothing without an error', () => {
    expect(screenError({error: null, loading: false})).toBeNull();
  });
});
