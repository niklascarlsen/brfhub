import {fromNodeHeaders} from 'better-auth/node';
import type {FastifyPluginAsync} from 'fastify';

import {AUTH_PATH, auth} from './auth.js';

// Better Auth speaks the fetch Request/Response pair, so the Fastify
// request is rebuilt as one and the answer copied back. Hidden from the
// OpenAPI document: the clients reach it through Better Auth's own client.
export const authRoutes: FastifyPluginAsync = async (app) => {
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
};
