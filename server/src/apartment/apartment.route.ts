import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {logEvent} from '../event/event.service.js';
import {errorResponses} from '../lib/errors.js';
import {getAdmin} from '../lib/user.js';
import {
  apartmentParamsSchema,
  apartmentSchema,
  createApartmentBodySchema,
  newResidentBodySchema,
  updateApartmentBodySchema,
} from './apartment.dto.js';
import {
  createApartment,
  listApartments,
  removeApartment,
  replaceResident,
  signOutApartment,
  updateApartment,
} from './apartment.service.js';

export const apartmentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/apartments',
    {
      schema: {
        response: {
          200: apartmentSchema.array(),
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const admin = await getAdmin(request);
      return listApartments(admin.organizationId);
    },
  );

  app.post(
    '/admin/apartments',
    {
      schema: {
        body: createApartmentBodySchema,
        response: {
          201: apartmentSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const created = await createApartment(
        admin.organizationId,
        request.body,
        app.notifier.forRequest(request.log),
      );
      await logEvent(request, admin, 'apartment.create', created.label);
      return reply.code(201).send(created);
    },
  );

  app.patch(
    '/admin/apartments/:id',
    {
      schema: {
        params: apartmentParamsSchema,
        body: updateApartmentBodySchema,
        response: {
          200: apartmentSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const admin = await getAdmin(request);
      const updated = await updateApartment(
        admin.organizationId,
        request.params.id,
        request.body,
        app.notifier.forRequest(request.log),
      );
      await logEvent(request, admin, 'apartment.update', updated.label);
      return updated;
    },
  );

  // Every device signed in as the apartment has to sign in again, after a
  // phone has gone missing.
  app.post(
    '/admin/apartments/:id/sign-out',
    {
      schema: {
        params: apartmentParamsSchema,
        response: {
          204: z.undefined(),
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const label = await signOutApartment(
        admin.organizationId,
        request.params.id,
      );
      await logEvent(request, admin, 'apartment.signOut', label);
      return reply.code(204).send();
    },
  );

  app.post(
    '/admin/apartments/:id/new-resident',
    {
      schema: {
        params: apartmentParamsSchema,
        body: newResidentBodySchema,
        response: {
          200: apartmentSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const admin = await getAdmin(request);
      const replaced = await replaceResident(
        admin,
        request.params.id,
        request.body,
        app.notifier.forRequest(request.log),
      );
      await logEvent(request, admin, 'apartment.newResident', replaced.label);
      return replaced;
    },
  );

  app.delete(
    '/admin/apartments/:id',
    {
      schema: {
        params: apartmentParamsSchema,
        response: {
          204: z.undefined(),
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const admin = await getAdmin(request);
      const label = await removeApartment(
        admin,
        request.params.id,
        app.notifier.forRequest(request.log),
      );
      await logEvent(request, admin, 'apartment.remove', label);
      return reply.code(204).send();
    },
  );
};
