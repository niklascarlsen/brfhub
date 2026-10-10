import type {FastifyBaseLogger} from 'fastify';

import type {Locale} from '../lib/locale.js';
import {sendPush} from '../lib/push.js';
import {
  listPushTokens,
  removePushTokens,
} from '../pushToken/pushToken.service.js';

export type Notification = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

// Each device gets the notification in its own language.
export async function notifyMembers(
  memberIds: string[],
  build: (locale: Locale) => Notification,
  log: FastifyBaseLogger,
): Promise<void> {
  if (memberIds.length === 0) {
    return;
  }

  const tokens = await listPushTokens(memberIds);

  try {
    const failures = await sendPush(
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
