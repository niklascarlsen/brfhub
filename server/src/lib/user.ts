import type {FastifyRequest} from 'fastify';

import {appError} from './errors.js';

export function getUserId(request: FastifyRequest): string {
  const header = request.headers['x-apartment-number'];

  if (typeof header !== 'string' || header.length === 0) {
    throw appError('UNAUTHORIZED', 'Missing apartment number');
  }

  return header;
}
