import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {fromNodeHeaders} from 'better-auth/node';
import {and, eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {account, user} from '../db/schema.js';
import {errorResponses} from '../lib/errors.js';
import {devSignIn} from '../lib/env.js';
import {AUTH_PATH, auth, DEV_CODE} from './auth.js';
import {totpCode, twoFactorSecret} from './auth.service.js';
import {
  signInMethodBodySchema,
  signInMethodSchema,
  type SignInMethod,
} from './auth.dto.js';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Better Auth speaks the fetch Request/Response pair, so the Fastify
  // request is rebuilt as one and the answer copied back. Hidden from the
  // OpenAPI document: the clients reach it through Better Auth's own client.
  app.route({
    method: ['GET', 'POST'],
    url: `${AUTH_PATH}/*`,
    schema: {hide: true},
    async handler(request, reply) {
      const response = await auth.handler(
        new Request(
          new URL(request.url, `${request.protocol}://${request.host}`),
          {
            method: request.method,
            headers: fromNodeHeaders(request.headers),
            body:
              request.body === undefined ? null : JSON.stringify(request.body),
          },
        ),
      );

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') {
          reply.header(key, value);
        }
      });
      // Several cookies must stay separate headers; forEach joins them.
      reply.header('set-cookie', response.headers.getSetCookie());

      return reply.send(await response.text());
    },
  });

  // How an address signs in: an admin with a password, one who has none
  // yet by choosing it with a mailed code, everyone else with a code from
  // their mail. An unknown address is told "code" like an apartment, and
  // Better Auth then sends nothing, so nobody can tell the two apart.
  app.post(
    '/sign-in/method',
    {
      schema: {
        body: signInMethodBodySchema,
        response: {200: signInMethodSchema, ...errorResponses},
      },
    },
    async (request): Promise<SignInMethod> => {
      const [found] = await db
        .select({admin: user.admin, credential: account.id})
        .from(user)
        .leftJoin(
          account,
          and(
            eq(account.userId, user.id),
            eq(account.providerId, 'credential'),
          ),
        )
        .where(eq(user.email, request.body.email));

      if (!found?.admin) {
        return {method: 'code'};
      }

      return {method: found.credential === null ? 'set-password' : 'password'};
    },
  );

  // The codes the login screens fill in: the one every mail carries, and
  // what the admin's authenticator would show. Only while devSignIn, and
  // hidden from the API document.
  if (devSignIn) {
    app.get(
      '/dev/codes',
      {schema: {hide: true}},
      async (request): Promise<{mailed: string; totp: string | null}> => {
        const email = (request.query as {email?: string}).email ?? '';
        const [account] = await db
          .select({id: user.id})
          .from(user)
          .where(eq(user.email, email.toLowerCase()));
        const secret = account ? await twoFactorSecret(account.id) : null;

        return {
          mailed: DEV_CODE,
          totp: secret === null ? null : await totpCode(secret),
        };
      },
    );
  }
};
