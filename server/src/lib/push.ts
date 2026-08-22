const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push responded ${response.status}`);
  }
}
