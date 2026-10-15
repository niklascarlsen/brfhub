import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import type {FastifyRequest} from 'fastify';
import {z} from 'zod';

import {logEvent} from '../event/event.service.js';
import {errorResponses} from '../lib/errors.js';
import {localize, type LocalizedText} from '../lib/locale.js';
import {getAdmin} from '../lib/user.js';
import {
  adminResourcesSchema,
  changePreviewBodySchema,
  changePreviewSchema,
  closingBodySchema,
  createKindBodySchema,
  createResourceBodySchema,
  idParamsSchema,
  putScheduleBodySchema,
  removeScheduleBodySchema,
  resourceOrderBodySchema,
  scheduleParamsSchema,
  updateKindBodySchema,
  updateResourceBodySchema,
} from './resourceAdmin.dto.js';
import type {Cancelled} from '../booking/lifecycle.js';
import type {Admin} from '../lib/user.js';
import {
  changeResource,
  createKind,
  createResource,
  deleteKind,
  listAdminResources,
  nameOfKind,
  nameOfResource,
  orderResources,
  previewChange,
  removeResource,
  reopenResource,
  updateKind,
  updateResource,
} from './resourceAdmin.service.js';

const createdSchema = z.object({id: z.string()});
const noContent = {204: z.undefined(), ...errorResponses};

// Which apartments a change cancelled bookings for, and why, for the other
// admins to see beside the change itself.
async function logCancelled(
  request: FastifyRequest,
  admin: Admin,
  id: string,
  cancelled: Cancelled[],
  reason: LocalizedText,
) {
  if (cancelled.length === 0) {
    return;
  }

  const apartments = [
    ...new Set(cancelled.map((booking) => booking.apartment)),
  ].join(', ');
  const said = localize(reason, admin.locale);
  const why = said ? ` (${said})` : '';

  await logEvent(
    request,
    admin,
    'booking.cancel',
    `${await nameOfResource(admin, id)}: ${apartments}${why}`,
  );
}

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
      const id = await createKind(admin, request.body);
      await logEvent(
        request,
        admin,
        'kind.create',
        await nameOfKind(admin, id),
      );
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
      await updateKind(admin, request.params.id, request.body);
      await logEvent(
        request,
        admin,
        'kind.update',
        await nameOfKind(admin, request.params.id),
      );
      return reply.code(204).send();
    },
  );

  app.delete(
    '/admin/kinds/:id',
    {schema: {params: idParamsSchema, response: noContent}},
    async (request, reply) => {
      const admin = await getAdmin(request);
      const name = await nameOfKind(admin, request.params.id);
      await deleteKind(admin.organizationId, request.params.id);
      await logEvent(request, admin, 'kind.remove', name);
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
      const id = await createResource(admin, request.body);
      await logEvent(
        request,
        admin,
        'resource.create',
        await nameOfResource(admin, id),
      );
      return reply.code(201).send({id});
    },
  );

  app.put(
    '/admin/resources/order',
    {schema: {body: resourceOrderBodySchema, response: noContent}},
    async (request, reply) => {
      const admin = await getAdmin(request);
      await orderResources(admin.organizationId, request.body.ids);
      await logEvent(request, admin, 'resource.order', '');
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
      await updateResource(admin, request.params.id, request.body);
      await logEvent(
        request,
        admin,
        'resource.update',
        await nameOfResource(admin, request.params.id),
      );
      return reply.code(204).send();
    },
  );

  // Writes nothing, so it logs nothing.
  app.post(
    '/admin/resources/:id/preview',
    {
      schema: {
        params: idParamsSchema,
        body: changePreviewBodySchema,
        response: {200: changePreviewSchema, ...errorResponses},
      },
    },
    async (request) => {
      const admin = await getAdmin(request);
      return previewChange(admin, request.params.id, request.body);
    },
  );

  app.delete(
    '/admin/resources/:id',
    {schema: {params: idParamsSchema, response: noContent}},
    async (request, reply) => {
      const admin = await getAdmin(request);
      const name = await nameOfResource(admin, request.params.id);
      await removeResource(admin, request.params.id);
      await logEvent(request, admin, 'resource.remove', name);
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
      const {validFrom, slots, ...cancelling} = request.body;
      const cancelled = await changeResource(
        admin,
        request.params.id,
        {change: 'schedule', validFrom, slots},
        cancelling,
        app.notifier.forRequest(request.log),
      );
      await logEvent(
        request,
        admin,
        'schedule.put',
        `${await nameOfResource(admin, request.params.id)} ${validFrom}`,
      );
      await logCancelled(
        request,
        admin,
        request.params.id,
        cancelled,
        cancelling.reason,
      );
      return reply.code(204).send();
    },
  );

  app.delete(
    '/admin/resources/:id/schedule/:validFrom',
    {
      schema: {
        params: scheduleParamsSchema,
        body: removeScheduleBodySchema,
        response: noContent,
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const {id, validFrom} = request.params;
      const cancelled = await changeResource(
        admin,
        id,
        {change: 'removeSchedule', validFrom},
        {cancels: request.body?.cancels ?? [], reason: {}},
        app.notifier.forRequest(request.log),
      );
      await logEvent(
        request,
        admin,
        'schedule.remove',
        `${await nameOfResource(admin, id)} ${validFrom}`,
      );
      await logCancelled(request, admin, id, cancelled, {});
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
      const {closesFrom, ...cancelling} = request.body;
      const cancelled = await changeResource(
        admin,
        request.params.id,
        {change: 'closing', closesFrom},
        cancelling,
        app.notifier.forRequest(request.log),
      );
      await logEvent(
        request,
        admin,
        'resource.close',
        `${await nameOfResource(admin, request.params.id)} ${closesFrom}`,
      );
      await logCancelled(
        request,
        admin,
        request.params.id,
        cancelled,
        cancelling.reason,
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
      await logEvent(
        request,
        admin,
        'resource.reopen',
        await nameOfResource(admin, request.params.id),
      );
      return reply.code(204).send();
    },
  );
};
