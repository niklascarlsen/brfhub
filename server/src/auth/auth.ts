import {expo} from '@better-auth/expo';
import {betterAuth} from 'better-auth';
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {deleteSessionCookie, expireCookie} from 'better-auth/cookies';
import {emailOTP, twoFactor} from 'better-auth/plugins';
import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import * as schema from '../db/schema.js';
import {devSignIn, production, WEB_ORIGIN} from '../lib/env.js';
import {sendSignInCode} from '../mail/mail.service.js';
import {
  adminSessionExpired,
  forgetTrustedDevices,
  MEMBER_SESSION_DAYS,
} from './sessions.js';

export const AUTH_PATH = '/auth';

// Better Auth's name for the cookie that lets a device skip the
// authenticator's code.
const TRUST_DEVICE_COOKIE = 'trust_device';

const DAY = 60 * 60 * 24;

// Better Auth's own bounds, written out so the type generation can hand
// them to the clients' password form.
export const PASSWORD_LENGTH = {min: 8, max: 128};

// Long enough to find the mail on a slow phone.
export const CODE_EXPIRES_IN_SECONDS = 10 * 60;

// Every mailed code while devSignIn, and the login screens fill it in.
export const DEV_CODE = '123456';

// Mirrors the CORS rule in app.ts: WEB_ORIGIN pins production, unset
// trusts whoever asks so dev works from any LAN address and Expo Go.
function trustedOrigins(request?: Request): string[] {
  const origin = request?.headers.get('origin');

  return [
    ...(WEB_ORIGIN ? [WEB_ORIGIN] : origin ? [origin, 'exp://**'] : []),
    'bookslot://',
  ];
}

// Whether the address belongs to an admin, who signs in with a password
// and never with a code.
async function isAdmin(email: string): Promise<boolean> {
  const [account] = await db
    .select({admin: schema.user.admin})
    .from(schema.user)
    .where(eq(schema.user.email, email.toLowerCase()));

  return account?.admin === true;
}

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

// The device stops being trusted to skip the authenticator's code: the
// record goes and the cookie, which holds its identifier after the last
// '!', is expired.
async function forgetThisDevice(ctx: HookContext): Promise<void> {
  const cookie = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE);
  const value = await ctx.getSignedCookie(cookie.name, ctx.context.secret);

  // Null without the cookie, false when its signature does not hold.
  if (typeof value !== 'string') {
    return;
  }

  const identifier = value.split('!').at(-1);
  if (identifier) {
    await ctx.context.internalAdapter.deleteVerificationByIdentifier(
      identifier,
    );
  }

  expireCookie(ctx, cookie);
}

// Better Auth's routes that would hand an admin what the authenticator
// knows: turning it off, its secret for another app, fresh backup codes.
// A stolen trusted device with the password could then pass the second
// step from anywhere. Only a colleague's reset takes the authenticator
// away, and the clients call none of these.
const AUTHENTICATOR_ROUTES = new Set([
  '/two-factor/disable',
  '/two-factor/get-totp-uri',
  '/two-factor/generate-backup-codes',
]);

// The routes a sign-in goes through, on which a stale session cookie left
// on the device is not what is being asked about.
function isSigningIn(path: string): boolean {
  return (
    path.startsWith('/sign-in') ||
    path.startsWith('/email-otp') ||
    path.startsWith('/two-factor/verify') ||
    path === '/sign-out'
  );
}

// An admin's session past its week is ended on whatever route it reaches
// first: Better Auth's own here, ours in getSignedIn. Asking for the
// session then finds none, as the clients expect when they are signed
// out; anything else is refused outright. The session is only read here:
// /get-session itself extends a used one and renews its cookie, which a
// hook's own headers would not reach the answer.
async function endStaleAdminSession(ctx: HookContext): Promise<void> {
  const session = await getSessionFromCtx(ctx, {disableRefresh: true});

  if (
    !session ||
    (session.user as {admin?: boolean}).admin !== true ||
    !adminSessionExpired(session.session.createdAt)
  ) {
    return;
  }

  await ctx.context.internalAdapter.deleteSession(session.session.token);
  deleteSessionCookie(ctx);

  if (ctx.path !== '/get-session') {
    throw new APIError(
      'UNAUTHORIZED',
      {message: 'Session expired', code: 'SESSION_EXPIRED'},
      ctx.responseHeaders,
    );
  }
}

export const auth = betterAuth({
  basePath: AUTH_PATH,
  database: drizzleAdapter(db, {provider: 'pg', schema}),
  // Accounts are created for residents and admins, never by them: see
  // createUser. The password is the admin's; apartments have none.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_LENGTH.min,
    maxPasswordLength: PASSWORD_LENGTH.max,
    // A password is reset because someone else may have the old one: every
    // session ends and every trusted device gives the authenticator's code
    // again. The admin signs in with the new password right after.
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({user: reset}) => {
      await forgetTrustedDevices(reset.id);
    },
  },
  session: {expiresIn: MEMBER_SESSION_DAYS * DAY, updateAge: DAY},
  // Counted per client address, which auth.route.ts hands over from
  // Fastify. Better Auth's own rules: three sign-ins per ten seconds and
  // three code requests per minute, the rest a hundred per ten seconds.
  rateLimit: {enabled: production},
  // Remembered on the user, so the admin still sees it after every session
  // has been ended.
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await db
            .update(schema.user)
            .set({lastSignInAt: new Date()})
            .where(eq(schema.user.id, session.userId));
        },
      },
    },
  },
  user: {
    additionalFields: {
      organizationId: {type: 'string', required: true, input: false},
      memberId: {type: 'string', required: false, input: false},
      admin: {type: 'boolean', required: true, input: false},
    },
  },
  trustedOrigins,
  // The rules hold on the server too, whatever the login screen shows: a
  // code never signs an admin in, and only an admin has a password to set.
  // Both are refused the way a wrong code is. An admin keeps the
  // authenticator once it is set up: only a colleague's reset takes it
  // away, so a stolen trusted device cannot turn it off.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (AUTHENTICATOR_ROUTES.has(ctx.path)) {
        throw new APIError('FORBIDDEN', {
          message:
            'Two-factor authentication can only be reset by another admin',
          code: 'TWO_FACTOR_RESET_ONLY',
        });
      }

      if (!isSigningIn(ctx.path)) {
        await endStaleAdminSession(ctx);
      }

      const email = ctx.body?.email;

      if (typeof email !== 'string') {
        return;
      }

      const admin = await isAdmin(email);
      const refused =
        (ctx.path === '/sign-in/email-otp' && admin) ||
        (ctx.path === '/email-otp/reset-password' && !admin);

      if (refused) {
        throw new APIError('BAD_REQUEST', {
          message: 'Invalid OTP',
          code: 'INVALID_OTP',
        });
      }
    }),
    // Signing out also stops trusting the device: whoever signs in on it
    // next gives the authenticator's code, as on a shared computer. A new
    // password chosen from inside the app forgets every trusted device,
    // like one reset with a mailed code (onPasswordReset above): the old
    // password may be in someone else's hands, and so may a device.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.context.returned instanceof APIError) {
        return;
      }

      if (ctx.path === '/sign-out') {
        await forgetThisDevice(ctx);
      }

      if (ctx.path === '/change-password') {
        // With revokeOtherSessions the request's session is gone and a
        // new one has been made; otherwise the request's still stands.
        const userId =
          ctx.context.newSession?.user.id ??
          (await getSessionFromCtx(ctx))?.user.id;

        if (userId) {
          await forgetTrustedDevices(userId);
        }

        await forgetThisDevice(ctx);
      }
    }),
  },
  plugins: [
    expo(),
    emailOTP({
      // An unknown address gets the same answer as a known one, and no
      // account: there is nobody to make one for.
      disableSignUp: true,
      expiresIn: CODE_EXPIRES_IN_SECONDS,
      storeOTP: 'hashed',
      ...(devSignIn ? {generateOTP: () => DEV_CODE} : {}),
      async sendVerificationOTP({email, otp, type}, ctx) {
        if (type !== 'sign-in' && type !== 'forget-password') {
          throw new Error(`No mail for a ${type} code`);
        }

        // A sign-in code goes to an apartment, a password code to an
        // admin. Any other address is answered like them and mailed
        // nothing.
        if ((await isAdmin(email)) !== (type === 'forget-password')) {
          return;
        }

        await sendSignInCode(
          email,
          otp,
          CODE_EXPIRES_IN_SECONDS,
          ctx?.headers?.get('accept-language') ?? undefined,
          type === 'sign-in' ? 'sign-in' : 'password',
        );
      },
    }),
    // The admin's second step. The authenticator's secret and the backup
    // codes are stored encrypted; a trusted device skips the code for a
    // month.
    twoFactor({
      issuer: 'Boka',
      backupCodeOptions: {storeBackupCodes: 'encrypted'},
    }),
  ],
});
