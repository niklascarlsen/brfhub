import type {FastifyBaseLogger} from 'fastify';

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

export async function notifyMembers(
  memberIds: string[],
  notification: Notification,
  log: FastifyBaseLogger,
): Promise<void> {
  if (memberIds.length === 0) {
    return;
  }

  const tokens = await listPushTokens(memberIds);

  try {
    const failures = await sendPush(
      tokens.map((token) => ({to: token, ...notification})),
    );

    await removePushTokens(
      failures
        .filter((failure) => failure.unregistered)
        .map((failure) => failure.token),
    );

    for (const failure of failures.filter((item) => !item.unregistered)) {
      log.error({failure, notification}, 'push notification rejected');
    }
  } catch (error) {
    log.error({err: error, notification}, 'push notification failed');
  }
}
