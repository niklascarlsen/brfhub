// One entry point for both push transports. Expo tokens go to the Expo
// push service, web subscriptions go straight to the browser push service
// with VAPID. A token is a web subscription when it is the JSON object the
// web client stored, Expo tokens look like ExponentPushToken[...].
// Failures come back per token so the caller can drop dead ones.
//
// Expo answers a send with a ticket per message, which only says it took
// it. Whether Apple or Google then delivered it comes later as a receipt,
// and that is where a device whose app was removed shows up.
import webpush, {WebPushError, type PushSubscription} from 'web-push';

import {withTimeout} from './timeout.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
// The most messages Expo takes in one request.
const EXPO_BATCH_SIZE = 100;
// The most receipts Expo answers in one request.
const EXPO_RECEIPT_BATCH_SIZE = 1000;
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

// A message Expo took, to ask about once its receipt is ready.
export type PushReceipt = {id: string; token: string};

export type PushResult = {failures: PushFailure[]; receipts: PushReceipt[]};

type PushError = {status: 'error'; message: string; details?: {error?: string}};
type PushTicket = {status: 'ok'; id: string} | PushError;

function failureOf(token: string, error: PushError): PushFailure {
  return {
    token,
    message: error.message,
    unregistered: error.details?.error === 'DeviceNotRegistered',
  };
}

function batchesOf<T>(items: T[], size: number): T[][] {
  return Array.from({length: Math.ceil(items.length / size)}, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

function isWebSubscription(token: string): boolean {
  return token.startsWith('{');
}

async function sendExpoBatch(messages: PushMessage[]): Promise<PushResult> {
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
  const result: PushResult = {failures: [], receipts: []};

  data.forEach((ticket, index) => {
    const token = messages[index]?.to;

    if (token === undefined) {
      return;
    }

    if (ticket.status === 'ok') {
      result.receipts.push({id: ticket.id, token});
    } else {
      result.failures.push(failureOf(token, ticket));
    }
  });

  return result;
}

async function expoReceiptBatch(
  receipts: PushReceipt[],
): Promise<PushFailure[]> {
  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    body: JSON.stringify({ids: receipts.map((receipt) => receipt.id)}),
  });

  if (!response.ok) {
    throw new Error(`Expo push receipts responded ${response.status}`);
  }

  // A receipt that is not ready, or already gone, is left out.
  const {data} = (await response.json()) as {
    data: Record<string, {status: 'ok'} | PushError>;
  };

  return receipts.flatMap(({id, token}) => {
    const receipt = data[id];
    return receipt?.status === 'error' ? [failureOf(token, receipt)] : [];
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
async function resultOf(
  messages: PushMessage[],
  send: (messages: PushMessage[]) => Promise<PushResult>,
): Promise<PushResult> {
  try {
    return await send(messages);
  } catch (error) {
    return {
      failures: messages.map((message) => ({
        token: message.to,
        message: error instanceof Error ? error.message : 'Push failed',
        unregistered: false,
      })),
      receipts: [],
    };
  }
}

async function sendPush(messages: PushMessage[]): Promise<PushResult> {
  const expo = messages.filter((message) => !isWebSubscription(message.to));
  const web = messages.filter((message) => isWebSubscription(message.to));

  const results = await Promise.all([
    ...batchesOf(expo, EXPO_BATCH_SIZE).map((batch) =>
      resultOf(batch, sendExpoBatch),
    ),
    resultOf(web, async (batch) => ({
      failures: await sendWebPush(batch),
      receipts: [],
    })),
  ]);

  return {
    failures: results.flatMap((result) => result.failures),
    receipts: results.flatMap((result) => result.receipts),
  };
}

// Throws when Expo cannot be asked, and the receipts are then lost: a dead
// device fails again at its next push and is dropped then.
async function checkReceipts(receipts: PushReceipt[]): Promise<PushFailure[]> {
  const failures = await Promise.all(
    batchesOf(receipts, EXPO_RECEIPT_BATCH_SIZE).map(expoReceiptBatch),
  );

  return failures.flat();
}

export type PushTransport = {
  send: (messages: PushMessage[]) => Promise<PushResult>;
  checkReceipts: (receipts: PushReceipt[]) => Promise<PushFailure[]>;
};

export const expoAndWebPush: PushTransport = {send: sendPush, checkReceipts};
