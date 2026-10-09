import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {organizations} from '../db/schema.js';
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
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!row) {
    throw new Error(`Unknown organization ${organizationId}`);
  }

  return row;
}

// A shorter window keeps the bookings already made; a longer one opens
// days that follow the schedules already set up for them.
export async function updateOrganizationSettings(
  organizationId: string,
  body: UpdateOrganizationBody,
): Promise<OrganizationSettings> {
  if (Object.values(body).some((value) => value !== undefined)) {
    await db
      .update(organizations)
      .set(body)
      .where(eq(organizations.id, organizationId));
  }

  return getOrganizationSettings(organizationId);
}
