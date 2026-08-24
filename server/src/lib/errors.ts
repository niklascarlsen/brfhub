import type {FastifyReply} from 'fastify';
import {z} from 'zod';

export const errorCodeSchema = z.enum([
  'HAS_ACTIVE_BOOKING',
  'SLOT_TAKEN',
  'SLOT_IN_PAST',
  'SLOT_STARTED',
  'OUTSIDE_BOOKING_WINDOW',
  'SLOT_AVAILABLE',
  'SLOT_IS_MINE',
  'ALREADY_SUBSCRIBED',
  'NOT_FOUND',
  'FORBIDDEN',
  'VALIDATION',
  'UNKNOWN',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

const ERRORS: Record<
  ErrorCode,
  {status: number; error: string; message: string}
> = {
  HAS_ACTIVE_BOOKING: {
    status: 409,
    error: 'Conflict',
    message: 'You already have an active booking',
  },
  SLOT_TAKEN: {
    status: 409,
    error: 'Conflict',
    message: 'Slot already booked',
  },
  SLOT_IN_PAST: {
    status: 400,
    error: 'Bad Request',
    message: 'Slot has already ended',
  },
  SLOT_STARTED: {
    status: 400,
    error: 'Bad Request',
    message: 'Slot has already started',
  },
  OUTSIDE_BOOKING_WINDOW: {
    status: 400,
    error: 'Bad Request',
    message: 'Date is outside the booking window',
  },
  SLOT_AVAILABLE: {
    status: 409,
    error: 'Conflict',
    message: 'Slot is free, book it instead',
  },
  SLOT_IS_MINE: {
    status: 409,
    error: 'Conflict',
    message: 'Slot is already yours',
  },
  ALREADY_SUBSCRIBED: {
    status: 409,
    error: 'Conflict',
    message: 'Already on the waiting list for this slot',
  },
  NOT_FOUND: {
    status: 404,
    error: 'Not Found',
    message: 'Not found',
  },
  FORBIDDEN: {
    status: 403,
    error: 'Forbidden',
    message: 'Forbidden',
  },
  VALIDATION: {
    status: 400,
    error: 'Bad Request',
    message: 'Bad Request',
  },
  UNKNOWN: {
    status: 500,
    error: 'Internal Server Error',
    message: 'Something went wrong',
  },
};

export const errorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  code: errorCodeSchema,
});

z.globalRegistry.add(errorSchema, {id: 'Error'});

function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }

  if ('cause' in error) {
    return pgErrorCode(error.cause);
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505';
}

function httpError(code: ErrorCode, message?: string, status?: number) {
  const entry = ERRORS[code];
  return {
    statusCode: status ?? entry.status,
    error: entry.error,
    message: message ?? entry.message,
    code,
  };
}

export function sendError(
  reply: FastifyReply,
  code: ErrorCode,
  message?: string,
  status?: number,
) {
  const body = httpError(code, message, status);
  return reply.code(body.statusCode).send(body);
}

export function errorCodeFromStatus(statusCode: number): ErrorCode {
  if (statusCode === 403) {
    return 'FORBIDDEN';
  }
  if (statusCode === 404) {
    return 'NOT_FOUND';
  }
  if (statusCode >= 400 && statusCode < 500) {
    return 'VALIDATION';
  }
  return 'UNKNOWN';
}

export function describeError(error: unknown): {
  statusCode: number;
  message: string;
} {
  if (error instanceof Error) {
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    return {statusCode, message: error.message};
  }

  return {statusCode: 500, message: 'Unknown error'};
}
