import {asc, eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {resources} from '../db/schema.js';
import type {Resource} from './resource.dto.js';

export function listResources(): Promise<Resource[]> {
  return db
    .select({
      id: resources.id,
      name: resources.name,
      kind: resources.kind,
      hasDryer: resources.hasDryer,
    })
    .from(resources)
    .orderBy(asc(resources.sortOrder));
}

export async function getResource(id: string): Promise<Resource | undefined> {
  const [row] = await db
    .select({
      id: resources.id,
      name: resources.name,
      kind: resources.kind,
      hasDryer: resources.hasDryer,
    })
    .from(resources)
    .where(eq(resources.id, id));

  return row;
}
