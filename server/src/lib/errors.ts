import type {FastifyReply} from 'fastify';
import {z} from 'zod';

export const errorCodeSchema = z.enum([
  'HAS_ACTIVE_BOOKING',
  'SLOT_TAKEN',
  'SLOT_IN_PAST',
  'SLOT_STARTED',
  'OUTSIDE_BOOKING_WINDOW',
  'SLOT_AVAILABLE',
  'APARTMENT_TAKEN',
  'EMAIL_TAKEN',
  'CHANGE_TOO_EARLY',
  'CHANGE_CANCELS_BOOKINGS',
  'ENDS_IN_PAST',
  'INVALID_SCHEDULE',
  'KIND_IN_USE',
  'RESOURCE_OPEN',
  'LANGUAGES_CHANGED',
  'TWO_FACTOR_REQUIRED',
  'LAST_ADMIN',
  'OWN_ACCOUNT',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION',
  'RATE_LIMITED',
  'UNKNOWN',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

const ERRORS: Record<ErrorCode, {status: number; message: string}> = {
  HAS_ACTIVE_BOOKING: {
    status: 409,
    message: 'You already have an active booking',
  },
  SLOT_TAKEN: {
    status: 409,
    message: 'Slot already booked',
  },
  SLOT_IN_PAST: {
    status: 400,
    message: 'Slot has already ended',
  },
  SLOT_STARTED: {
    status: 400,
    message: 'Slot has already started',
  },
  OUTSIDE_BOOKING_WINDOW: {
    status: 400,
    message: 'Date is outside the booking window',
  },
  SLOT_AVAILABLE: {
    status: 409,
    message: 'Slot is free, book it instead',
  },
  APARTMENT_TAKEN: {
    status: 409,
    message: 'The organization already has an apartment with that number',
  },
  EMAIL_TAKEN: {
    status: 409,
    message: 'Another account already uses that email',
  },
  CHANGE_TOO_EARLY: {
    status: 400,
    message: 'The change would start on a day that has begun',
  },
  // Someone booked meanwhile: the change would cancel a booking the admin
  // has not seen.
  CHANGE_CANCELS_BOOKINGS: {
    status: 409,
    message: 'The change would cancel bookings not agreed to',
  },
  ENDS_IN_PAST: {
    status: 400,
    message: 'The announcement would end before today',
  },
  INVALID_SCHEDULE: {
    status: 400,
    message: 'The slots overlap or end before they start',
  },
  // A resource is closed before it is removed, which has cancelled what was
  // booked on it with word to the apartments.
  RESOURCE_OPEN: {
    status: 409,
    message: 'Close the resource before removing it',
  },
  KIND_IN_USE: {
    status: 409,
    message: 'Resources still use that kind',
  },
  // The text left out a language the organization uses, or has one it
  // does not: the admin's form is older than the organization's languages.
  LANGUAGES_CHANGED: {
    status: 409,
    message: "The text is not in the organization's languages",
  },
  // An admin reads nothing but the account until an authenticator is set
  // up.
  TWO_FACTOR_REQUIRED: {
    status: 403,
    message: 'Set up two-factor authentication first',
  },
  LAST_ADMIN: {
    status: 409,
    message: 'The organization needs at least one admin',
  },
  OWN_ACCOUNT: {
    status: 409,
    message: 'An admin cannot do this to their own account',
  },
  NOT_FOUND: {
    status: 404,
    message: 'Not found',
  },
  UNAUTHORIZED: {
    status: 401,
    message: 'Not authenticated',
  },
  FORBIDDEN: {
    status: 403,
    message: 'Forbidden',
  },
  VALIDATION: {
    status: 400,
    message: 'Bad Request',
  },
  RATE_LIMITED: {
    status: 429,
    message: 'Too many requests, try again in a minute',
  },
  UNKNOWN: {
    status: 500,
    message: 'Something went wrong',
  },
};

export const errorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  code: errorCodeSchema,
});

z.globalRegistry.add(errorSchema, {id: 'Error'});

export const errorResponses = {
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  409: errorSchema,
  429: errorSchema,
  500: errorSchema,
};

export type AppError = Error & {code: ErrorCode; statusCode: number};

export function appError(code: ErrorCode, message?: string): AppError {
  const entry = ERRORS[code];

  return Object.assign(new Error(message ?? entry.message), {
    name: 'AppError',
    code,
    statusCode: entry.status,
  });
}

export function isAppError(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code in ERRORS
  );
}

export function sendError(
  reply: FastifyReply,
  code: ErrorCode,
  message?: string,
) {
  const entry = ERRORS[code];

  return reply.code(entry.status).send({
    statusCode: entry.status,
    message: message ?? entry.message,
    code,
  });
}
