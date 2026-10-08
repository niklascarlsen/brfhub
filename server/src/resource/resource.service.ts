import {and, asc, eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {resourceKinds, resourceSlots, resources} from '../db/schema.js';
import type {BookingRules, Resource} from './resource.dto.js';

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

function selectBookable() {
  return db
    .select({...resourceFields, maxActive: resourceKinds.maxActive})
    .from(resources)
    .innerJoin(
      resourceKinds,
      and(
        eq(resourceKinds.organizationId, resources.organizationId),
        eq(resourceKinds.id, resources.kindId),
      ),
    );
}

export function listBookableResources(
  organizationId: string,
): Promise<BookableResource[]> {
  return selectBookable()
    .where(eq(resources.organizationId, organizationId))
    .orderBy(asc(resources.sortOrder));
}

export async function getResource(
  organizationId: string,
  id: string,
): Promise<BookableResource | undefined> {
  const [row] = await selectBookable().where(
    and(eq(resources.organizationId, organizationId), eq(resources.id, id)),
  );

  return row;
}

// Kinds come in the order of their first resource, so the rules read in the
// same order as the booking page.
export async function getBookingRules(
  organizationId: string,
): Promise<BookingRules> {
  const [kinds, bookable, slots] = await Promise.all([
    db
      .select({
        id: resourceKinds.id,
        name: resourceKinds.name,
        maxActive: resourceKinds.maxActive,
      })
      .from(resourceKinds)
      .where(eq(resourceKinds.organizationId, organizationId)),
    listResources(organizationId),
    db
      .select({
        resourceId: resourceSlots.resourceId,
        start: resourceSlots.start,
        end: resourceSlots.end,
      })
      .from(resourceSlots)
      .innerJoin(resources, eq(resources.id, resourceSlots.resourceId))
      .where(eq(resources.organizationId, organizationId))
      .orderBy(asc(resourceSlots.start)),
  ]);

  const kindOrder = [...new Set(bookable.map((resource) => resource.kind))];

  return {
    kinds: kindOrder.flatMap((kindId) => {
      const kind = kinds.find((item) => item.id === kindId);

      if (!kind) {
        return [];
      }

      return [
        {
          ...kind,
          resources: bookable
            .filter((resource) => resource.kind === kindId)
            .map(({id, name, tags}) => ({
              id,
              name,
              tags,
              slots: slots
                .filter((slot) => slot.resourceId === id)
                .map(({start, end}) => ({start, end})),
            })),
        },
      ];
    }),
  };
}
