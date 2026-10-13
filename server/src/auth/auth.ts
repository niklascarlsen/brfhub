import {expo} from '@better-auth/expo';
import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import * as schema from '../db/schema.js';
import {WEB_ORIGIN} from '../lib/env.js';

export const AUTH_PATH = '/auth';

const DAY = 60 * 60 * 24;

// Better Auth's own bounds, written out so the type generation can hand
// them to the clients' password form.
export const PASSWORD_LENGTH = {min: 8, max: 128};

// Mirrors the CORS rule in app.ts: WEB_ORIGIN pins production, unset
// trusts whoever asks so dev works from any LAN address and Expo Go.
function trustedOrigins(request?: Request): string[] {
  const origin = request?.headers.get('origin');

  return [
    ...(WEB_ORIGIN ? [WEB_ORIGIN] : origin ? [origin, 'exp://**'] : []),
    'bookslot://',
  ];
}

export const auth = betterAuth({
  basePath: AUTH_PATH,
  database: drizzleAdapter(db, {provider: 'pg', schema}),
  // Accounts are created for residents, never by them: see createUser.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_LENGTH.min,
    maxPasswordLength: PASSWORD_LENGTH.max,
  },
  session: {expiresIn: 7 * DAY, updateAge: DAY},
  // Remembered on the user, so the admin still sees it after a new
  // password has ended every session.
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
      role: {type: ['member', 'admin'], required: true, input: false},
      organizationId: {type: 'string', required: true, input: false},
      memberId: {type: 'string', required: false, input: false},
    },
  },
  trustedOrigins,
  plugins: [expo()],
});
