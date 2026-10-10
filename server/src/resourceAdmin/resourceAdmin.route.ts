import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {errorResponses} from '../lib/errors.js';
import {getAdmin} from '../lib/user.js';
import {
  adminResourcesSchema,
  closingBodySchema,
  createKindBodySchema,
  createResourceBodySchema,
  idParamsSchema,
  putScheduleBodySchema,
  resourceOrderBodySchema,
  scheduleParamsSchema,
  updateKindBodySchema,
  updateResourceBodySchema,
} from './resourceAdmin.dto.js';
import {
  closeResource,
  createKind,
  createResource,
  deleteKind,
  deleteSchedule,
  listAdminResources,
  orderResources,
  putSchedule,
  reopenResource,
  updateKind,
  updateResource,
} from './resourceAdmin.service.js';

const createdSchema = z.object({id: z.string()});
const noContent = {204: z.undefined(), ...errorResponses};

// Every write answers with nothing, or the new id; the client reloads the
// list, which carries the dates the rules depend on.
export const resourceAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/resources',
    {schema: {response: {200: adminResourcesSchema, ...errorResponses}}},
    async (request) => {
      const admin = await getAdmin(request);
      return listAdminResources(admin);
    },
  );

  app.post(
    '/admin/kinds',
    {
      schema: {
        body: createKindBodySchema,
        response: {201: createdSchema, ...errorResponses},
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const id = await createKind(admin.organizationId, request.body);
      return reply.code(201).send({id});
    },
  );

  app.patch(
    '/admin/kinds/:id',
    {
      schema: {
        params: idParamsSchema,
        body: updateKindBodySchema,
        response: noContent,
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      await updateKind(admin.organizationId, request.params.id, request.body);
      return reply.code(204).send();
    },
  );

  app.delete(
    '/admin/kinds/:id',
    {schema: {params: idParamsSchema, response: noContent}},
    async (request, reply) => {
      const admin = await getAdmin(request);
      await deleteKind(admin.organizationId, request.params.id);
      return reply.code(204).send();
    },
  );

  app.post(
    '/admin/resources',
    {
      schema: {
        body: createResourceBodySchema,
        response: {201: createdSchema, ...errorResponses},
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const id = await createResource(admin.organizationId, request.body);
      return reply.code(201).send({id});
    },
  );

  app.put(
    '/admin/resources/order',
    {schema: {body: resourceOrderBodySchema, response: noContent}},
    async (request, reply) => {
      const admin = await getAdmin(request);
      await orderResources(admin.organizationId, request.body.ids);
      return reply.code(204).send();
    },
  );

  app.patch(
    '/admin/resources/:id',
    {
      schema: {
        params: idParamsSchema,
        body: updateResourceBodySchema,
        response: noContent,
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      await updateResource(
        admin.organizationId,
        request.params.id,
        request.body,
      );
      return reply.code(204).send();
    },
  );

  app.put(
    '/admin/resources/:id/schedule',
    {
      schema: {
        params: idParamsSchema,
        body: putScheduleBodySchema,
        response: noContent,
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      await putSchedule(
        admin.organizationId,
        request.params.id,
        request.body.validFrom,
        request.body.slots,
      );
      return reply.code(204).send();
    },
  );

  app.delete(
    '/admin/resources/:id/schedule/:validFrom',
    {schema: {params: scheduleParamsSchema, response: noContent}},
    async (request, reply) => {
      const admin = await getAdmin(request);
      await deleteSchedule(
        admin.organizationId,
        request.params.id,
        request.params.validFrom,
      );
      return reply.code(204).send();
    },
  );

  app.put(
    '/admin/resources/:id/closing',
    {
      schema: {
        params: idParamsSchema,
        body: closingBodySchema,
        response: noContent,
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      await closeResource(
        admin.organizationId,
        request.params.id,
        request.body.closesFrom,
      );
      return reply.code(204).send();
    },
  );

  app.delete(
    '/admin/resources/:id/closing',
    {schema: {params: idParamsSchema, response: noContent}},
    async (request, reply) => {
      const admin = await getAdmin(request);
      await reopenResource(admin.organizationId, request.params.id);
      return reply.code(204).send();
    },
  );
};
