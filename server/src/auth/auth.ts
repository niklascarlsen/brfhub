import {expo} from '@better-auth/expo';
import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';

import {db} from '../db/index.js';
import * as schema from '../db/schema.js';
import {WEB_ORIGIN} from '../lib/env.js';

export const AUTH_PATH = '/auth';

const DAY = 60 * 60 * 24;

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
  emailAndPassword: {enabled: true, disableSignUp: true},
  session: {expiresIn: 7 * DAY, updateAge: DAY},
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
