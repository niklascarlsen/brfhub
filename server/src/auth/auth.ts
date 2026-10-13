import {expo} from '@better-auth/expo';
import {betterAuth} from 'better-auth';
import {APIError, createAuthMiddleware} from 'better-auth/api';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {emailOTP} from 'better-auth/plugins';
import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import * as schema from '../db/schema.js';
import {WEB_ORIGIN} from '../lib/env.js';
import {sendSignInCode} from '../mail/mail.service.js';

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
  // The password rule holds on the server too: a code never signs an admin
  // in, however it was come by. Refused the way a wrong code is.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path === '/sign-in/email-otp' &&
        typeof ctx.body?.email === 'string' &&
        (await isAdmin(ctx.body.email))
      ) {
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
      async sendVerificationOTP({email, otp, type}, ctx) {
        if (type !== 'sign-in') {
          throw new Error(`No mail for a ${type} code`);
        }

        // An admin's address is answered like any other and mailed nothing.
        if (await isAdmin(email)) {
          return;
        }

        await sendSignInCode(
          email,
          otp,
          CODE_EXPIRES_IN_SECONDS,
          ctx?.headers?.get('accept-language') ?? undefined,
        );
      },
    }),
  ],
});
