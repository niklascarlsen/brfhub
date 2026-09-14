const production = process.env.NODE_ENV === 'production';

// Better Auth only rate limits and refuses a default secret in production,
// so the mode has to be set on purpose and the secret has to be there.
if (production && !process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is required in production');
}

// The web client's origin, allowed to send cookies and to call /auth.
// Unset trusts whoever asks, which only dev may do.
function readWebOrigin(): string | undefined {
  const value = process.env.WEB_ORIGIN;

  if (!value) {
    if (production) {
      throw new Error('WEB_ORIGIN is required in production');
    }

    return undefined;
  }

  return new URL(value).origin;
}

export const WEB_ORIGIN = readWebOrigin();
