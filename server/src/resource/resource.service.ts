import {and, asc, eq, gt, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {
  organizations,
  resourceKinds,
  resourceSlots,
  resources,
} from '../db/schema.js';
import {asDateText, todaySql} from '../lib/time.js';
import type {BookingRules, Resource} from './resource.dto.js';
import {resourceOpenOn, slotInEffect} from './schedule.query.js';

const resourceFields = {
  id: resources.id,
  name: resources.name,
  kind: resources.kindId,
  tags: resources.tags,
};

export type BookableResource = Resource & {maxActive: number};

// What members see: the organization's resources that are still open.
function bookableIn(organizationId: string) {
  return and(
    eq(resources.organizationId, organizationId),
    resourceOpenOn(todaySql()),
  );
}

export function listResources(organizationId: string): Promise<Resource[]> {
  return db
    .select(resourceFields)
    .from(resources)
    .where(bookableIn(organizationId))
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
    .where(bookableIn(organizationId))
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

type Version = {validFrom: string; slots: {start: string; end: string}[]};

// Groups slot rows, ordered by validFrom and start, into schedule versions.
function versionsOf(
  rows: {validFrom: string; start: string; end: string}[],
): Version[] {
  const versions: Version[] = [];

  for (const {validFrom, start, end} of rows) {
    const last = versions.at(-1);

    if (last?.validFrom === validFrom) {
      last.slots.push({start, end});
    } else {
      versions.push({validFrom, slots: [{start, end}]});
    }
  }

  return versions;
}

// Kinds come in the order of their first resource, so the rules read in the
// same order as the booking page.
export async function getBookingRules(
  organizationId: string,
): Promise<BookingRules> {
  const [[organization], kinds, bookable, open] = await Promise.all([
    db
      .select({rulesText: organizations.rulesText})
      .from(organizations)
      .where(eq(organizations.id, organizationId)),
    db
      .select({
        id: resourceKinds.id,
        name: resourceKinds.name,
        maxActive: resourceKinds.maxActive,
      })
      .from(resourceKinds)
      .where(eq(resourceKinds.organizationId, organizationId)),
    db
      .select({...resourceFields, closesFrom: resources.closesFrom})
      .from(resources)
      .where(bookableIn(organizationId))
      .orderBy(asc(resources.sortOrder)),
    // The version in effect today and every later one.
    db
      .select({
        resourceId: resourceSlots.resourceId,
        validFrom: asDateText(resourceSlots.validFrom),
        current: sql<boolean>`${slotInEffect(todaySql())}`,
        start: resourceSlots.start,
        end: resourceSlots.end,
      })
      .from(resourceSlots)
      .innerJoin(resources, eq(resources.id, resourceSlots.resourceId))
      .where(
        and(
          eq(resources.organizationId, organizationId),
          sql`(${slotInEffect(todaySql())} or ${gt(resourceSlots.validFrom, todaySql())})`,
        ),
      )
      .orderBy(asc(resourceSlots.validFrom), asc(resourceSlots.start)),
  ]);

  const kindOrder = [...new Set(bookable.map((resource) => resource.kind))];

  return {
    text: organization?.rulesText ?? '',
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
            .map(({id, name, tags, closesFrom}) => {
              const own = open.filter((row) => row.resourceId === id);

              return {
                id,
                name,
                tags,
                slots: own
                  .filter((row) => row.current)
                  .map(({start, end}) => ({start, end})),
                changes: versionsOf(own.filter((row) => !row.current)),
                closesFrom,
              };
            }),
        },
      ];
    }),
  };
}
