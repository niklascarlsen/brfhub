import {z} from 'zod';

export const errorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
});

z.globalRegistry.add(errorSchema, {id: 'Error'});

export function pgErrorCode(error: unknown): string | undefined {
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

export function httpError(statusCode: number, error: string, message: string) {
  return {statusCode, error, message};
}

export function describeError(error: unknown): {
  statusCode: number;
  name: string;
  message: string;
} {
  if (error instanceof Error) {
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    return {statusCode, name: error.name, message: error.message};
  }

  return {statusCode: 500, name: 'Error', message: 'Unknown error'};
}
