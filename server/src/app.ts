import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify, {type FastifyServerOptions} from 'fastify';

import {isAppError, sendError} from './lib/errors.js';
import {WEB_ORIGIN} from './lib/env.js';
import {accountRoutes} from './account/account.route.js';
import {apartmentRoutes} from './apartment/apartment.route.js';
import {authRoutes} from './auth/auth.route.js';
import {bookingRoutes} from './booking/booking.route.js';
import {pushTokenRoutes} from './pushToken/pushToken.route.js';
import {resourceRoutes} from './resource/resource.route.js';
import {slotRoutes} from './slot/slot.route.js';
import {subscriptionRoutes} from './subscription/subscription.route.js';

export async function buildApp(options: FastifyServerOptions = {}) {
  const server = Fastify(options).withTypeProvider<ZodTypeProvider>();

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  server.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const details = error.validation
        .map((issue) => `${issue.instancePath || '/'} ${issue.message}`)
        .join(', ');

      return sendError(
        reply,
        'VALIDATION',
        `Request does not match schema: ${details}`,
      );
    }

    if (isResponseSerializationError(error)) {
      request.log.error({err: error}, 'response failed its schema');
      return sendError(reply, 'UNKNOWN', 'Response did not match schema');
    }

    if (isAppError(error)) {
      return sendError(reply, error.code, error.message);
    }

    if (
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode < 500
    ) {
      return sendError(reply, 'VALIDATION', error.message);
    }

    request.log.error({err: error}, 'request failed');
    return sendError(reply, 'UNKNOWN');
  });

  server.setNotFoundHandler((request, reply) =>
    sendError(
      reply,
      'NOT_FOUND',
      `Route ${request.method} ${request.url} not found`,
    ),
  );

  await server.register(cors, {
    origin: WEB_ORIGIN ?? true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
  });

  await server.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Booking API',
        version: '1.0.0',
      },
      servers: [{url: 'http://localhost:3000'}],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  await server.register(swaggerUi, {routePrefix: '/docs'});

  await server.register(authRoutes);
  await server.register(accountRoutes);
  await server.register(apartmentRoutes);
  await server.register(resourceRoutes);
  await server.register(slotRoutes);
  await server.register(bookingRoutes);
  await server.register(subscriptionRoutes);
  await server.register(pushTokenRoutes);

  return server;
}
