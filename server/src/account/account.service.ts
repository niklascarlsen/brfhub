import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {organizations} from '../db/schema.js';
import type {SignedIn} from '../lib/user.js';
import type {Account} from './account.dto.js';

async function organizationName(organizationId: string): Promise<string> {
  const [organization] = await db
    .select({name: organizations.name})
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!organization) {
    throw new Error(`Unknown organization ${organizationId}`);
  }

  return organization.name;
}

export async function getAccount(signedIn: SignedIn): Promise<Account> {
  if (signedIn.role === 'admin') {
    const {admin} = signedIn;

    return {
      role: 'admin',
      organizationName: await organizationName(admin.organizationId),
      name: admin.name,
    };
  }

  const {member} = signedIn;

  return {
    role: 'member',
    organizationName: await organizationName(member.organizationId),
    apartment: member.label,
  };
}
