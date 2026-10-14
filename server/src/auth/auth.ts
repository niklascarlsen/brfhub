import {expo} from '@better-auth/expo';
import {betterAuth} from 'better-auth';
import {APIError, createAuthMiddleware} from 'better-auth/api';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {emailOTP, twoFactor} from 'better-auth/plugins';
import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import * as schema from '../db/schema.js';
import {devSignIn, WEB_ORIGIN} from '../lib/env.js';
import {sendSignInCode} from '../mail/mail.service.js';
import {forgetTrustedDevices} from './sessions.js';

export const AUTH_PATH = '/auth';

const DAY = 60 * 60 * 24;

// Better Auth's own bounds, written out so the type generation can hand
// them to the clients' password form.
export const PASSWORD_LENGTH = {min: 8, max: 128};

// An apartment signs in with a code from its mail and stays signed in for
// as long as it keeps using the app. An admin's session is cut short in
// getSignedIn, since it opens every apartment.
export const MEMBER_SESSION_DAYS = 180;
export const ADMIN_SESSION_DAYS = 7;

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
  // Both are refused the way a wrong code is.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
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
