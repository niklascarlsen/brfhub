import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
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

import {appError, isAppError, sendError} from './lib/errors.js';
import {production, WEB_ORIGIN} from './lib/env.js';
import type {SendMail} from './lib/mail.js';
import type {PushTransport} from './lib/push.js';
import {setMailTransport} from './mail/mail.service.js';
import {createNotifier} from './notification/notification.service.js';
import {accountRoutes} from './account/account.route.js';
import {adminsRoutes} from './admins/admins.route.js';
import {eventRoutes} from './event/event.route.js';
import {announcementRoutes} from './announcement/announcement.route.js';
import {apartmentRoutes} from './apartment/apartment.route.js';
import {authRoutes} from './auth/auth.route.js';
import {bookingRoutes} from './booking/booking.route.js';
import {organizationRoutes} from './organization/organization.route.js';
import {pushTokenRoutes} from './pushToken/pushToken.route.js';
import {resourceRoutes} from './resource/resource.route.js';
import {resourceAdminRoutes} from './resourceAdmin/resourceAdmin.route.js';
import {slotRoutes} from './slot/slot.route.js';
import {subscriptionRoutes} from './subscription/subscription.route.js';

// The server passes expoAndWebPush and smtpMail. The tests pass their own, to see
// who would be told what without sending anything.
export async function buildApp({
  push,
  mail,
  ...options
}: FastifyServerOptions & {push: PushTransport; mail: SendMail}) {
  const server = Fastify(options).withTypeProvider<ZodTypeProvider>();

  setMailTransport(mail);
  server.decorate('notifier', createNotifier(push, server.log));
  // Push that is still on its way when the server stops is sent first.
  server.addHook('onClose', () => server.notifier.close());

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
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // The API answers JSON, so a content security policy has nothing to
  // protect and would only break Swagger UI in dev.
  await server.register(helmet, {contentSecurityPolicy: false});

  // Per client address, which trustProxy resolves. Generous for the API
  // as a whole and tight where a request costs nothing to send and tells
  // something: a route sets its own with config.rateLimit. Production
  // only, like Better Auth's, so dev and the tests are not held up.
  if (production) {
    await server.register(rateLimit, {
      max: 300,
      timeWindow: '1 minute',
      // Answered through the error handler, like every other refusal.
      errorResponseBuilder: () => appError('RATE_LIMITED'),
    });
  }

  // The API document is read by the type generation and by whoever
  // develops against the server, never by the clients.
  if (!production) {
    await registerDocs(server);
  }

  await server.register(authRoutes);
  await server.register(accountRoutes);
  await server.register(apartmentRoutes);
  await server.register(adminsRoutes);
  await server.register(eventRoutes);
  await server.register(resourceAdminRoutes);
  await server.register(organizationRoutes);
  await server.register(announcementRoutes);
  await server.register(resourceRoutes);
  await server.register(slotRoutes);
  await server.register(bookingRoutes);
  await server.register(subscriptionRoutes);
  await server.register(pushTokenRoutes);

  return server;
}

async function registerDocs(server: Awaited<ReturnType<typeof Fastify>>) {
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
}
