import {API_BASE_URL} from '@/api/baseUrl';

// The seeded apartment and admin password, so a development build signs
// in with a couple of taps.
export const DEV_EMAIL = __DEV__ ? '12@example.com' : '';
export const DEV_PASSWORD = __DEV__ ? 'password' : '';

// The dev server tells what the mail and the authenticator would, so dev
// signs in and sets up the authenticator with taps alone. Nothing when
// the server keeps them to itself (DEV_SIGN_IN=off), and the codes are
// read like a user does.
export async function devCode(
  email: string,
  kind: 'mailed' | 'totp',
): Promise<string> {
  if (!__DEV__) {
    return '';
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/dev/codes?email=${encodeURIComponent(email)}`,
    );
    if (!response.ok) {
      return '';
    }
    const codes = (await response.json()) as Record<string, string | null>;
    return codes[kind] ?? '';
  } catch {
    return '';
  }
}
