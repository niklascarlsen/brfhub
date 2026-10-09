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
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION',
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
