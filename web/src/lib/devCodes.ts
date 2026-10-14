import {apiBaseUrl} from '@/api/baseUrl';

// The seeded apartment and admin password, so a development build signs
// in with a couple of clicks.
export const DEV_EMAIL = import.meta.env.DEV ? '12@example.com' : '';
export const DEV_PASSWORD = import.meta.env.DEV ? 'password' : '';

// The dev server tells what the mail and the authenticator would, so dev
// signs in and sets up the authenticator with clicks alone. Nothing when
// the server keeps them to itself (DEV_SIGN_IN=off), and the codes are
// read like a user does.
export async function devCode(
  email: string,
  kind: 'mailed' | 'totp',
): Promise<string> {
  if (!import.meta.env.DEV) {
    return '';
  }

  try {
    const response = await fetch(
      `${apiBaseUrl()}/dev/codes?email=${encodeURIComponent(email)}`,
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
