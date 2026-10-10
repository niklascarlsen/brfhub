import {and, asc, eq, gt, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {
  organizations,
  resourceKinds,
  resourceSlots,
  resources,
} from '../db/schema.js';
import {localized, localizedTags, type Locale} from '../lib/locale.js';
import {asDateText, todaySql} from '../lib/time.js';
import type {Organization} from '../lib/user.js';
import type {BookingRules, Resource} from './resource.dto.js';
import {resourceOpenOn, slotInEffect} from './schedule.query.js';

function resourceFields(locale: Locale) {
  return {
    id: resources.id,
    name: localized(resources.name, locale),
    kind: resources.kindId,
    tags: localizedTags(resources.tags, locale),
  };
}

// The resource a booking or queue place is for, as resourceRefSchema
// names it.
export function resourceRefFields(locale: Locale) {
  return {
    resourceId: resources.id,
    resourceName: localized(resources.name, locale),
    resourceKind: resources.kindId,
  };
}

export type BookableResource = Resource & {maxActive: number};

// What members see: the organization's resources that are still open.
function bookableIn({organizationId, timeZone}: Organization) {
  return and(
    eq(resources.organizationId, organizationId),
    resourceOpenOn(todaySql(timeZone)),
  );
}

export function listResources(organization: Organization): Promise<Resource[]> {
  return db
    .select(resourceFields(organization.locale))
    .from(resources)
    .where(bookableIn(organization))
    .orderBy(asc(resources.sortOrder));
}

function selectBookable(locale: Locale) {
  return db
    .select({...resourceFields(locale), maxActive: resourceKinds.maxActive})
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
  organization: Organization,
): Promise<BookableResource[]> {
  return selectBookable(organization.locale)
    .where(bookableIn(organization))
    .orderBy(asc(resources.sortOrder));
}

export async function getResource(
  {organizationId, locale}: Organization,
  id: string,
): Promise<BookableResource | undefined> {
  const [row] = await selectBookable(locale).where(
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
  organization: Organization,
): Promise<BookingRules> {
  const {organizationId, timeZone, locale} = organization;
  const today = todaySql(timeZone);
  const [[settings], kinds, bookable, open] = await Promise.all([
    db
      .select({rulesText: localized(organizations.rulesText, locale)})
      .from(organizations)
      .where(eq(organizations.id, organizationId)),
    db
      .select({
        id: resourceKinds.id,
        name: localized(resourceKinds.name, locale),
        maxActive: resourceKinds.maxActive,
      })
      .from(resourceKinds)
      .where(eq(resourceKinds.organizationId, organizationId)),
    db
      .select({...resourceFields(locale), closesFrom: resources.closesFrom})
      .from(resources)
      .where(bookableIn(organization))
      .orderBy(asc(resources.sortOrder)),
    // The version in effect today and every later one.
    db
      .select({
        resourceId: resourceSlots.resourceId,
        validFrom: asDateText(resourceSlots.validFrom),
        current: sql<boolean>`${slotInEffect(today)}`,
        start: resourceSlots.start,
        end: resourceSlots.end,
      })
      .from(resourceSlots)
      .innerJoin(resources, eq(resources.id, resourceSlots.resourceId))
      .where(
        and(
          eq(resources.organizationId, organizationId),
          sql`(${slotInEffect(today)} or ${gt(resourceSlots.validFrom, today)})`,
        ),
      )
      .orderBy(asc(resourceSlots.validFrom), asc(resourceSlots.start)),
  ]);

  const kindOrder = [...new Set(bookable.map((resource) => resource.kind))];

  return {
    text: settings?.rulesText ?? '',
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
