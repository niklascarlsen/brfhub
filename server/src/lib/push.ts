// One entry point for both push transports. Expo tokens go to the Expo
// push service, web subscriptions go straight to the browser push service
// with VAPID. A token is a web subscription when it is the JSON object the
// web client stored, Expo tokens look like ExponentPushToken[...].
// Failures come back per token so the caller can drop dead ones.
import webpush, {WebPushError, type PushSubscription} from 'web-push';

import {withTimeout} from './timeout.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// The most messages Expo takes in one request.
const EXPO_BATCH_SIZE = 100;
// A released slot is old news after an hour, so the push service drops
// undelivered messages instead of waking the device later.
const WEB_PUSH_TTL_SECONDS = 60 * 60;
// A push service that takes the connection and never answers would
// otherwise hold the send, and the slots queued behind it, forever.
export const PUSH_TIMEOUT_MS = 10_000;

// The Android channels the app registers, so each kind of push can be
// turned off on its own in the phone's settings.
export type PushChannel = 'slots' | 'announcements';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  channel: PushChannel;
  data?: Record<string, string>;
};

export type PushFailure = {
  token: string;
  message: string;
  unregistered: boolean;
};

type PushTicket =
  | {status: 'ok'}
  | {status: 'error'; message: string; details?: {error?: string}};

function isWebSubscription(token: string): boolean {
  return token.startsWith('{');
}

async function sendExpoBatch(messages: PushMessage[]): Promise<PushFailure[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    body: JSON.stringify(
      messages.map(({channel, ...message}) => ({
        ...message,
        priority: 'high',
        channelId: channel,
      })),
    ),
  });

  if (!response.ok) {
    throw new Error(`Expo push responded ${response.status}`);
  }

  const {data} = (await response.json()) as {data: PushTicket[]};

  return data.flatMap((ticket, index) => {
    const message = messages[index];

    if (ticket.status === 'ok' || message === undefined) {
      return [];
    }

    return {
      token: message.to,
      message: ticket.message,
      unregistered: ticket.details?.error === 'DeviceNotRegistered',
    };
  });
}

// Generate a key pair with: npx web-push generate-vapid-keys
function vapidDetails() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      'VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required for web push',
    );
  }

  return {subject, publicKey, privateKey};
}

async function sendWebPush(messages: PushMessage[]): Promise<PushFailure[]> {
  if (messages.length === 0) {
    return [];
  }

  const vapid = vapidDetails();

  const failures = await Promise.all(
    messages.map(async (message): Promise<PushFailure[]> => {
      try {
        // web-push only times out a socket that goes quiet, so a service
        // that answers slowly enough could still hold the send.
        await withTimeout(
          webpush.sendNotification(
            JSON.parse(message.to) as PushSubscription,
            JSON.stringify({
              title: message.title,
              body: message.body,
              data: message.data,
            }),
            {
              vapidDetails: vapid,
              TTL: WEB_PUSH_TTL_SECONDS,
              urgency: 'high',
              // Closes the socket of a send the deadline gave up on.
              timeout: PUSH_TIMEOUT_MS,
            },
          ),
          PUSH_TIMEOUT_MS,
          'Push timed out',
        );

        return [];
      } catch (error) {
        const status = error instanceof WebPushError ? error.statusCode : 0;

        return [
          {
            token: message.to,
            message: error instanceof Error ? error.message : 'Web push failed',
            unregistered: status === 404 || status === 410,
          },
        ];
      }
    }),
  );

  return failures.flat();
}

// A transport that throws as a whole is reported as one failure per token
// so the caller sees the same shape for both paths.
async function failuresFrom(
  messages: PushMessage[],
  send: (messages: PushMessage[]) => Promise<PushFailure[]>,
): Promise<PushFailure[]> {
  try {
    return await send(messages);
  } catch (error) {
    return messages.map((message) => ({
      token: message.to,
      message: error instanceof Error ? error.message : 'Push failed',
      unregistered: false,
    }));
  }
}

export type SendPush = (messages: PushMessage[]) => Promise<PushFailure[]>;

export async function sendPush(
  messages: PushMessage[],
): Promise<PushFailure[]> {
  const expo = messages.filter((message) => !isWebSubscription(message.to));
  const batches = Array.from(
    {length: Math.ceil(expo.length / EXPO_BATCH_SIZE)},
    (_, index) =>
      expo.slice(index * EXPO_BATCH_SIZE, (index + 1) * EXPO_BATCH_SIZE),
  );

  const failures = await Promise.all([
    ...batches.map((batch) => failuresFrom(batch, sendExpoBatch)),
    failuresFrom(
      messages.filter((message) => isWebSubscription(message.to)),
      sendWebPush,
    ),
  ]);

  return failures.flat();
}
