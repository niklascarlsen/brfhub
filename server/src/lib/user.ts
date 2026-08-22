import type {FastifyRequest} from 'fastify';

export function getUserId(request: FastifyRequest): string {
  const header = request.headers['x-user-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return 'me';
}
