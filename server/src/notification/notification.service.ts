import type {FastifyBaseLogger} from 'fastify';

import type {Locale} from '../lib/locale.js';
import type {SendPush} from '../lib/push.js';
import {
  listPushTokens,
  removePushTokens,
} from '../pushToken/pushToken.service.js';

export type Notification = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type Notifier = ReturnType<typeof createNotifier>;

declare module 'fastify' {
  interface FastifyInstance {
    notifier: Notifier;
  }
}

// Sends push through the transport it is given: Expo and Web Push in the
// server, one in memory in the tests.
export function createNotifier(push: SendPush, log: FastifyBaseLogger) {
  const pending = new Set<Promise<void>>();

  // Each device gets the notification in its own language.
  async function notifyMembers(
    memberIds: string[],
    build: (locale: Locale) => Notification,
  ): Promise<void> {
    if (memberIds.length === 0) {
      return;
    }

    const tokens = await listPushTokens(memberIds);

    try {
      const failures = await push(
        tokens.map(({token, locale}) => ({to: token, ...build(locale)})),
      );

      await removePushTokens(
        failures
          .filter((failure) => failure.unregistered)
          .map((failure) => failure.token),
      );

      for (const failure of failures.filter((item) => !item.unregistered)) {
        log.error({failure}, 'push notification rejected');
      }
    } catch (error) {
      log.error({err: error}, 'push notification failed');
    }
  }

  // Runs the sends after the caller has answered, so a slow push service
  // never holds up the request or turns a done change into a client
  // timeout. They go one after another, and one that fails does not stop
  // the rest.
  function later(sends: (() => Promise<void>)[]): void {
    const task = (async () => {
      for (const send of sends) {
        await send().catch((error: unknown) => {
          log.error({err: error}, 'could not send a notification');
        });
      }
    })().finally(() => {
      pending.delete(task);
    });

    pending.add(task);
  }

  // Resolves once every send started so far is done. The server waits on
  // it before closing, the tests before they look at what was sent.
  async function idle(): Promise<void> {
    while (pending.size > 0) {
      await Promise.all(pending);
    }
  }

  return {notifyMembers, later, idle};
}
