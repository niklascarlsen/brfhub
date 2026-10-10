import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {organizations} from '../db/schema.js';
import {assertTranslated} from '../lib/locale.js';
import type {
  OrganizationSettings,
  UpdateOrganizationBody,
} from './organization.dto.js';

export async function getOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  const [row] = await db
    .select({
      name: organizations.name,
      bookingWindowDays: organizations.bookingWindowDays,
      locales: organizations.locales,
      rulesText: organizations.rulesText,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!row) {
    throw new Error(`Unknown organization ${organizationId}`);
  }

  return row;
}

// A shorter window keeps the bookings already made; a longer one opens
// days that follow the schedules already set up for them. A language
// turned off keeps its text, which shows again once it is turned back on.
export async function updateOrganizationSettings(
  organizationId: string,
  {rulesText, ...body}: UpdateOrganizationBody,
): Promise<OrganizationSettings> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({locales: organizations.locales})
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .for('update');

    if (!current) {
      throw new Error(`Unknown organization ${organizationId}`);
    }

    const locales = body.locales ?? current.locales;
    const changes = {
      ...body,
      ...(rulesText === undefined
        ? {}
        : {rulesText: assertTranslated(rulesText, locales, {optional: true})}),
    };

    if (Object.values(changes).some((value) => value !== undefined)) {
      await tx
        .update(organizations)
        .set(changes)
        .where(eq(organizations.id, organizationId));
    }
  });

  return getOrganizationSettings(organizationId);
}
