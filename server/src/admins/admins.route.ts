import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {logEvent} from '../event/event.service.js';
import {errorResponses} from '../lib/errors.js';
import {getAdmin} from '../lib/user.js';
import {
  addAdminBodySchema,
  adminParamsSchema,
  adminUserSchema,
} from './admins.dto.js';
import {
  addAdmin,
  listAdmins,
  removeAdmin,
  resetAdminTwoFactor,
} from './admins.service.js';

export const adminsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/admins',
    {schema: {response: {200: adminUserSchema.array(), ...errorResponses}}},
    async (request) => listAdmins(await getAdmin(request)),
  );

  app.post(
    '/admin/admins',
    {
      schema: {
        body: addAdminBodySchema,
        response: {201: adminUserSchema, ...errorResponses},
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const added = await addAdmin(
        admin,
        request.body,
        app.notifier.forRequest(request.log),
      );
      await logEvent(request, admin, 'admin.add', added.email);
      return reply.code(201).send(added);
    },
  );

  app.delete(
    '/admin/admins/:id',
    {
      schema: {
        params: adminParamsSchema,
        response: {204: z.undefined(), ...errorResponses},
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const removed = await removeAdmin(admin, request.params.id);
      await logEvent(request, admin, 'admin.remove', removed.email);
      return reply.code(204).send();
    },
  );

  // Another admin's authenticator is forgotten, for one that was lost.
  app.post(
    '/admin/admins/:id/reset-two-factor',
    {
      schema: {
        params: adminParamsSchema,
        response: {204: z.undefined(), ...errorResponses},
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const reset = await resetAdminTwoFactor(admin, request.params.id);
      await logEvent(request, admin, 'admin.resetTwoFactor', reset.email);
      return reply.code(204).send();
    },
  );
};
