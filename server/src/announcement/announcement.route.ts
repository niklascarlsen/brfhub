import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {logEvent} from '../event/event.service.js';
import {errorResponses} from '../lib/errors.js';
import {localize} from '../lib/locale.js';
import {getAdmin, getMember} from '../lib/user.js';
import {
  adminAnnouncementsSchema,
  announcementBodySchema,
  announcementParamsSchema,
  announcementSchema,
} from './announcement.dto.js';
import {
  createAnnouncement,
  deleteAnnouncement,
  listActiveAnnouncements,
  listAdminAnnouncements,
  updateAnnouncement,
} from './announcement.service.js';

export const announcementRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/announcements',
    {schema: {response: {200: announcementSchema.array(), ...errorResponses}}},
    async (request) => {
      const member = await getMember(request);
      return listActiveAnnouncements(member);
    },
  );

  app.get(
    '/admin/announcements',
    {
      schema: {
        response: {200: adminAnnouncementsSchema, ...errorResponses},
      },
    },
    async (request) => {
      const admin = await getAdmin(request);
      return listAdminAnnouncements(admin);
    },
  );

  app.post(
    '/admin/announcements',
    {
      schema: {
        body: announcementBodySchema,
        response: {201: z.object({id: z.uuid()}), ...errorResponses},
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const id = await createAnnouncement(admin, request.body);
      await logEvent(
        request,
        admin,
        'announcement.create',
        localize(request.body.title, admin.locale) ?? '',
      );
      return reply.code(201).send({id});
    },
  );

  app.put(
    '/admin/announcements/:id',
    {
      schema: {
        params: announcementParamsSchema,
        body: announcementBodySchema,
        response: {204: z.undefined(), ...errorResponses},
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      await updateAnnouncement(admin, request.params.id, request.body);
      await logEvent(
        request,
        admin,
        'announcement.update',
        localize(request.body.title, admin.locale) ?? '',
      );
      return reply.code(204).send();
    },
  );

  app.delete(
    '/admin/announcements/:id',
    {
      schema: {
        params: announcementParamsSchema,
        response: {204: z.undefined(), ...errorResponses},
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const title = await deleteAnnouncement(
        admin.organizationId,
        request.params.id,
      );
      await logEvent(
        request,
        admin,
        'announcement.remove',
        localize(title, admin.locale) ?? '',
      );
      return reply.code(204).send();
    },
  );
};
