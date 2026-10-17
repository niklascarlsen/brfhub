import {describeEvent, formatEventTime} from '@booking/core/admin/events';
import {
  organizationSectionTitle,
  type OrganizationSection,
} from '@booking/core/admin/location';
import type {
  AdminUser,
  EventPage,
  OrganizationSettings,
} from '@booking/core/api/types';
import {CATALOGS, joinNames, localize} from '@booking/core/i18n/catalog';
import type {ReactNode} from 'react';

import {ActionRow, Badge} from '@/admin/Rows';
import {LIST, SECTION_LABEL} from '@/admin/styles';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

export type Page = OrganizationSection;

const ORGANIZATION_PAGES = [
  'details',
  'languages',
  'rules',
  'admins',
  'history',
] as const satisfies readonly Page[];

// A group of the menu, heading its pages like a page heads its content.
const MENU_HEADING =
  'mb-2 ml-3 text-base font-semibold tracking-tight text-theme-ink';

// The desktop's menu of the organization's pages, beside the one shown.
export function PageMenu({
  shown,
  attention,
  onOpen,
}: {
  shown: Page;
  attention: number;
  onOpen: (page: Page) => void;
}) {
  const t = useMessages();

  const link = (page: Page) => (
    <button
      key={page}
      type='button'
      aria-current={page === shown ? 'page' : undefined}
      onClick={() => onOpen(page)}
      className={`flex h-10 items-center justify-between gap-2 rounded-xl px-3 text-left text-sm transition-colors ${
        page === shown
          ? 'bg-theme-surface font-semibold text-theme-ink shadow-[0_0_0_1px_var(--color-theme-line)]'
          : 'font-medium text-theme-muted hover:text-theme-ink'
      }`}
    >
      {organizationSectionTitle(page, t)}
      {page === 'admins' && attention > 0 ? (
        <Badge>{String(attention)}</Badge>
      ) : null}
    </button>
  );

  return (
    <nav aria-label={t.admin.organization.pages} className='flex flex-col'>
      <h2 className={MENU_HEADING}>{t.tabs.organization}</h2>
      {ORGANIZATION_PAGES.map(link)}
      {/* The account and its password on one page, apart from the
          organization's, as a button so signing out is easy to find. */}
      <button
        type='button'
        aria-current={shown === 'account' ? 'page' : undefined}
        onClick={() => onOpen('account')}
        className={`mt-7 flex h-10 items-center rounded-full border px-4 text-left text-sm font-semibold tracking-tight text-theme-ink transition-colors ${
          shown === 'account'
            ? 'border-theme-ink bg-theme-surface'
            : 'border-theme-edge bg-theme-surface hover:bg-theme-sunk'
        }`}
      >
        {organizationSectionTitle('account', t)}
      </button>
    </nav>
  );
}

// The phone's way in: each page as a row that says what is on it now.
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
      <section className='mb-6.5'>
        <h2 className={SECTION_LABEL}>{t.tabs.organization}</h2>
        <div className={LIST}>
          {ORGANIZATION_PAGES.map((page) => (
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
            />
          ))}
        </div>
      </section>
      {account}
    </>
  );
}
