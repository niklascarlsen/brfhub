import {describeEvent, formatEventTime} from '@brfhub/core/admin/events';
import {
  organizationSectionTitle,
  type OrganizationSection,
} from '@brfhub/core/admin/location';
import type {
  AdminUser,
  EventPage,
  OrganizationSettings,
} from '@brfhub/core/api/types';
import {CATALOGS, joinNames, localize} from '@brfhub/core/i18n/catalog';
import type {ReactNode} from 'react';
import {Text, View} from 'react-native';

import {ActionRow, Badge} from '@/admin/Rows';
import {SECTION_LABEL} from '@/admin/styles';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

export type Page = OrganizationSection;

const ORGANIZATION_PAGES = [
  'details',
  'languages',
  'rules',
  'admins',
  'history',
] as const satisfies readonly Page[];

// The way in: each page as a row that says what is on it now, and the
// account under them.
export function Overview({
  organization,
  admins,
  latest,
  onOpen,
  account,
}: {
  organization: OrganizationSettings | null;
  admins: AdminUser[] | null;
  // The newest page of the history, a single event.
  latest: EventPage | null;
  onOpen: (page: Page) => void;
  account: ReactNode;
}) {
  const t = useMessages();
  const {locale} = useLocale();
  const attention =
    admins?.filter((admin) => !admin.twoFactorEnabled).length ?? 0;
  const newest = latest?.events[0];
  const rules = organization
    ? localize(organization.rulesText, locale)?.trim().split('\n')[0]
    : undefined;

  const summaries: Record<(typeof ORGANIZATION_PAGES)[number], string> = {
    details: organization
      ? t.admin.organization.windowSummary(
          organization.name,
          organization.bookingWindowDays,
        )
      : '',
    languages: organization
      ? joinNames(
          organization.locales.map(
            (language) => CATALOGS[language].language.name,
          ),
          t,
        )
      : '',
    rules: organization ? rules || t.admin.organization.noRules : '',
    admins: admins ? t.admin.admins.count(admins.length) : '',
    history: !latest
      ? ''
      : newest
        ? `${describeEvent(newest, t)} · ${formatEventTime(newest.at, t)}`
        : t.admin.events.none,
  };

  return (
    <>
      <View className='mb-[26px]'>
        <Text accessibilityRole='header' className={SECTION_LABEL}>
          {t.tabs.organization}
        </Text>
        <View className='overflow-hidden rounded-card border border-theme-line bg-theme-surface'>
          {ORGANIZATION_PAGES.map((page, index) => (
            <ActionRow
              key={page}
              label={organizationSectionTitle(page, t)}
              description={summaries[page]}
              badge={
                page === 'admins' && attention > 0 ? (
                  <Badge>{t.admin.admins.withoutTwoFactor(attention)}</Badge>
                ) : undefined
              }
              onPress={() => onOpen(page)}
              last={index === ORGANIZATION_PAGES.length - 1}
            />
          ))}
        </View>
      </View>
      {account}
    </>
  );
}
