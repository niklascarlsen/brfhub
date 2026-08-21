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

import {describeError, httpError} from './lib/errors.js';
import {bookingRoutes} from './routes/bookings.js';
import {slotRoutes} from './routes/slots.js';

export async function buildApp(options: FastifyServerOptions = {}) {
  const server = Fastify(options).withTypeProvider<ZodTypeProvider>();

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  server.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const details = error.validation
        .map((issue) => `${issue.instancePath || '/'} ${issue.message}`)
        .join(', ');

      return reply
        .code(400)
        .send(
          httpError(
            400,
            'Bad Request',
            `Request does not match schema: ${details}`,
          ),
        );
    }

    if (isResponseSerializationError(error)) {
      request.log.error({err: error}, 'response failed its schema');
      return reply
        .code(500)
        .send(
          httpError(
            500,
            'Internal Server Error',
            'Response did not match schema',
          ),
        );
    }

    const {statusCode, name, message} = describeError(error);

    if (statusCode >= 500) {
      request.log.error({err: error}, 'request failed');
      return reply
        .code(statusCode)
        .send(
          httpError(
            statusCode,
            'Internal Server Error',
            'Something went wrong',
          ),
        );
    }

    return reply.code(statusCode).send(httpError(statusCode, name, message));
  });

  server.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send(
        httpError(
          404,
          'Not Found',
          `Route ${request.method} ${request.url} not found`,
        ),
      ),
  );

  await server.register(cors, {origin: true});

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

  await server.register(slotRoutes);
  await server.register(bookingRoutes);

  return server;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
