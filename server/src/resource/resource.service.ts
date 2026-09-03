import {and, asc, eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {resourceKinds, resources} from '../db/schema.js';
import type {Resource} from './resource.dto.js';

const resourceFields = {
  id: resources.id,
  name: resources.name,
  kind: resources.kindId,
  tags: resources.tags,
};

export type BookableResource = Resource & {maxActive: number};

export function listResources(organizationId: string): Promise<Resource[]> {
  return db
    .select(resourceFields)
    .from(resources)
    .where(eq(resources.organizationId, organizationId))
    .orderBy(asc(resources.sortOrder));
}

export async function getResource(
  organizationId: string,
  id: string,
): Promise<BookableResource | undefined> {
  const [row] = await db
    .select({...resourceFields, maxActive: resourceKinds.maxActive})
    .from(resources)
    .innerJoin(
      resourceKinds,
      and(
        eq(resourceKinds.organizationId, resources.organizationId),
        eq(resourceKinds.id, resources.kindId),
      ),
    )
    .where(
      and(eq(resources.organizationId, organizationId), eq(resources.id, id)),
    );

  return row;
}
