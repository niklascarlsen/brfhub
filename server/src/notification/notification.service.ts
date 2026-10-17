import type {FastifyBaseLogger} from 'fastify';

import type {Locale} from '../lib/locale.js';
import type {
  PushChannel,
  PushFailure,
  PushReceipt,
  PushTransport,
} from '../lib/push.js';
import {
  listPushTokens,
  removePushTokens,
} from '../pushToken/pushToken.service.js';

export type Notification = {
  title: string;
  body: string;
  channel: PushChannel;
  data?: Record<string, string>;
};

export type Notifier = {
  notifyMembers: (recipients: Recipients[]) => Promise<void>;
  later: (send: () => Promise<void>) => void;
  idle: () => Promise<void>;
  checkReceiptsNow: () => Promise<void>;
  close: () => Promise<void>;
  forRequest: (log: FastifyBaseLogger) => Notifier;
};

// Expo has most receipts ready within a quarter of an hour, and keeps them
// for a day.
export const RECEIPT_DELAY_MS = 15 * 60 * 1000;

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

// What every request's notifier shares: the sends still on their way, and
// the receipt checks waiting for their time.
type Shared = {
  pending: Set<Promise<void>>;
  receiptChecks: Map<NodeJS.Timeout, () => void>;
};

// Sends push through the transport it is given: Expo and Web Push in the
// server, one in memory in the tests. Each request gets its own, logging
// with the request's id, and all of them share what is still on its way.
export function createNotifier(
  push: PushTransport,
  log: FastifyBaseLogger,
  shared: Shared = {pending: new Set(), receiptChecks: new Map()},
): Notifier {
  const {pending, receiptChecks} = shared;

  // A device the push service no longer knows is dropped, unless it has
  // registered again since the push was sent, as a reinstalled app does.
  async function settle(failures: PushFailure[], sentAt: Date): Promise<void> {
    await removePushTokens(
      failures
        .filter((failure) => failure.unregistered)
        .map((failure) => failure.token),
      sentAt,
    );

    for (const failure of failures.filter((item) => !item.unregistered)) {
      log.error({failure}, 'push notification rejected');
    }
  }

  // Not kept past a restart: a device whose receipt is lost fails again at
  // its next push.
  function checkLater(receipts: PushReceipt[], sentAt: Date): void {
    const check = () => {
      clearTimeout(timer);
      receiptChecks.delete(timer);
      later(async () => {
        await settle(await push.checkReceipts(receipts), sentAt);
      });
    };
    const timer = setTimeout(check, RECEIPT_DELAY_MS);

    // Waiting for a receipt never keeps the process alive.
    timer.unref();
    receiptChecks.set(timer, check);
  }

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
      const messages = recipients.flatMap(({memberIds: group, build}) => {
        const members = new Set(group);
        return tokens
          .filter((token) => members.has(token.memberId))
          .map(({token, locale}) => ({to: token, ...build(locale)}));
      });

      if (messages.length === 0) {
        return;
      }

      const sentAt = new Date();
      const {failures, receipts} = await push.send(messages);

      await settle(failures, sentAt);

      if (receipts.length > 0) {
        checkLater(receipts, sentAt);
      }
    } catch (error) {
      log.error({err: error}, 'push notification failed');
    }
  }

  // Runs the send after the caller has answered, so a slow push service
  // never holds up the request or turns a done change into a client
  // timeout.
  function later(send: () => Promise<void>): void {
    // Starts once the caller's own queries have had their turn.
    const task = new Promise<void>((resolve) => {
      setImmediate(resolve);
    })
      .then(send)
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

  // Checks every waiting receipt at once, for the tests.
  async function checkReceiptsNow(): Promise<void> {
    for (const check of [...receiptChecks.values()]) {
      check();
    }

    await idle();
  }

  // The server stops without waiting for receipts, but sends what is still
  // on its way.
  async function close(): Promise<void> {
    for (const timer of receiptChecks.keys()) {
      clearTimeout(timer);
    }

    receiptChecks.clear();
    await idle();
  }

  function forRequest(requestLog: FastifyBaseLogger): Notifier {
    return createNotifier(push, requestLog, shared);
  }

  return {notifyMembers, later, idle, checkReceiptsNow, close, forRequest};
}
