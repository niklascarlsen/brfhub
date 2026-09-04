const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHANNEL_ID = 'slots';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
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

export async function sendPush(
  messages: PushMessage[],
): Promise<PushFailure[]> {
  if (messages.length === 0) {
    return [];
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(
      messages.map((message) => ({
        ...message,
        priority: 'high',
        channelId: CHANNEL_ID,
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
