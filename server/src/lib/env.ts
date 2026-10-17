import 'dotenv/config';

// Production is the default: only NODE_ENV=development or test opens the
// shortcuts below, so a deploy that forgets the variable gets the real
// rules, not the ones for a laptop. The npm scripts in package.json set it
// for dev, the tests and the scripts.
const mode = process.env.NODE_ENV;
export const development = mode === 'development' || mode === 'test';
export const production = !development;

// Dev signs in without a mailbox or an authenticator: every mailed code is
// the same one and /dev/codes tells the authenticator's. DEV_SIGN_IN=off
// tests the real flow against Mailpit; production never has it.
export const devSignIn = development && process.env.DEV_SIGN_IN !== 'off';

// Better Auth signs the cookies and encrypts the authenticators' secrets
// with it, so it is required everywhere: a default secret would sign
// sessions anyone could forge.
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is required (copy .env.example to .env)');
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

// The reverse proxies in front of the server, as addresses or CIDR ranges,
// whose x-forwarded-for may name the client. Empty means the server is
// reached directly and the header is ignored: anyone can send one.
function readTrustedProxies(): string[] {
  return (process.env.TRUSTED_PROXIES ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export const TRUSTED_PROXIES = readTrustedProxies();

// Where mail goes out. Unset sends to Mailpit from docker-compose, which
// only dev may do.
function readMailSettings(): {smtpUrl: string; from: string} {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.MAIL_FROM;

  if (production && (!smtpUrl || !from)) {
    throw new Error('SMTP_URL and MAIL_FROM are required in production');
  }

  return {
    smtpUrl: smtpUrl || 'smtp://localhost:1025',
    from: from || 'BrfHub <brfhub@localhost>',
  };
}

export const MAIL = readMailSettings();
