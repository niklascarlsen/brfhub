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

export type Notifier = {
  notifyMembers: (recipients: Recipients[]) => Promise<void>;
  later: (send: () => Promise<void>) => void;
  idle: () => Promise<void>;
  forRequest: (log: FastifyBaseLogger) => Notifier;
};

declare module 'fastify' {
  interface FastifyInstance {
    notifier: Notifier;
  }
}

// Who to tell, and what in each language.
export type Recipients = {
  memberIds: string[];
  build: (locale: Locale) => Notification;
};

// Sends push through the transport it is given: Expo and Web Push in the
// server, one in memory in the tests. Each request gets its own, logging
// with the request's id, and all of them share what is still on its way.
export function createNotifier(
  push: SendPush,
  log: FastifyBaseLogger,
  pending = new Set<Promise<void>>(),
) {
  // Every device gets its message in its own language, all of them in one
  // call to the push service. A member in two groups hears of both.
  async function notifyMembers(recipients: Recipients[]): Promise<void> {
    const memberIds = [
      ...new Set(recipients.flatMap((group) => group.memberIds)),
    ];

    if (memberIds.length === 0) {
      return;
    }

    try {
      const tokens = await listPushTokens(memberIds);
      const messages = recipients.flatMap(({memberIds: group, build}) =>
        tokens
          .filter((token) => group.includes(token.memberId))
          .map(({token, locale}) => ({to: token, ...build(locale)})),
      );

      if (messages.length === 0) {
        return;
      }

      const failures = await push(messages);

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

  // Runs the send after the caller has answered, so a slow push service
  // never holds up the request or turns a done change into a client
  // timeout.
  function later(send: () => Promise<void>): void {
    const task = send()
      .catch((error: unknown) => {
        log.error({err: error}, 'could not send a notification');
      })
      .finally(() => {
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

  function forRequest(requestLog: FastifyBaseLogger): Notifier {
    return createNotifier(push, requestLog, pending);
  }

  return {notifyMembers, later, idle, forRequest};
}
