import {and, eq, gt, gte, isNull, or} from 'drizzle-orm';

import {db} from '../db/index.js';
import {
  announcements,
  organizations,
  resourceKinds,
  resources,
} from '../db/schema.js';
import {LOCALES, type Locale} from '../lib/locale.js';
import {todaySql} from '../lib/time.js';
import type {Admin, SignedIn} from '../lib/user.js';
import type {Account, Untranslated} from './account.dto.js';

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

type Text = Partial<Record<Locale, string | string[]>>;

// The organization's languages the text is not written in. Text that is
// empty in every language lacks nothing.
function missingIn(text: Text, locales: readonly Locale[]): Locale[] {
  const written = (locale: Locale) => (text[locale]?.length ?? 0) > 0;

  return LOCALES.some(written)
    ? locales.filter((locale) => !written(locale))
    : [];
}

async function untranslatedOf({
  organizationId,
  timeZone,
  locales,
}: Admin): Promise<Untranslated> {
  const today = todaySql(timeZone);

  const [kindRows, resourceRows, announcementRows, [organization]] =
    await Promise.all([
      db
        .select({name: resourceKinds.name})
        .from(resourceKinds)
        .where(eq(resourceKinds.organizationId, organizationId)),
      db
        .select({name: resources.name, tags: resources.tags})
        .from(resources)
        .where(
          and(
            eq(resources.organizationId, organizationId),
            or(isNull(resources.closesFrom), gt(resources.closesFrom, today)),
          ),
        ),
      db
        .select({title: announcements.title, body: announcements.body})
        .from(announcements)
        .where(
          and(
            eq(announcements.organizationId, organizationId),
            or(isNull(announcements.endsOn), gte(announcements.endsOn, today)),
          ),
        ),
      db
        .select({rulesText: organizations.rulesText})
        .from(organizations)
        .where(eq(organizations.id, organizationId)),
    ]);

  const missing = new Set<Locale>();
  // How many of the items lack a language, noting which ones they lack.
  const count = (texts: Text[][]) =>
    texts.filter((item) => {
      const lacking = item.flatMap((text) => missingIn(text, locales));
      lacking.forEach((locale) => missing.add(locale));
      return lacking.length > 0;
    }).length;

  const result = {
    kinds: count(kindRows.map((row) => [row.name])),
    resources: count(resourceRows.map((row) => [row.name, row.tags])),
    announcements: count(announcementRows.map((row) => [row.title, row.body])),
    rules: count([[organization?.rulesText ?? {}]]) > 0,
  };

  return missing.size === 0
    ? null
    : {locales: LOCALES.filter((locale) => missing.has(locale)), ...result};
}

export async function getAccount(signedIn: SignedIn): Promise<Account> {
  if (signedIn.role === 'admin') {
    const {admin} = signedIn;

    return {
      role: 'admin',
      organizationName: await organizationName(admin.organizationId),
      locales: admin.locales,
      untranslated: await untranslatedOf(admin),
    };
  }

  const {member} = signedIn;

  return {
    role: 'member',
    organizationName: await organizationName(member.organizationId),
    locales: member.locales,
    apartment: member.label,
  };
}
