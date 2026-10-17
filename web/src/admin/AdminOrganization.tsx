import {useAdminAccount, useRefreshAccount} from '@booking/core/admin/account';
import {organizationSectionTitle} from '@booking/core/admin/location';
import {useSwitchMode} from '@booking/core/auth/mode';
import {useId, useState, type ReactNode} from 'react';

import {AdminPage} from '@/admin/AdminPage';
import {AdminDetail, Admins} from '@/admin/Admins';
import {ChangePassword} from '@/admin/ChangePassword';
import {Gone} from '@/admin/Gone';
import {History} from '@/admin/History';
import {useAdminLocation} from '@/admin/location';
import {Overview, PageMenu, type Page} from '@/admin/OrganizationOverview';
import {ActionRow} from '@/admin/Rows';
import {
  DetailsForm,
  LanguagesForm,
  RulesForm,
  type Part,
} from '@/admin/SettingsForms';
import {LIST, SECTION_LABEL} from '@/admin/styles';
import {useConfirmLeave} from '@/admin/unsaved';
import {signOut} from '@/auth/signOut';
import {Account} from '@/components/Account';
import {Notice} from '@/components/Notice';
import {adminLoad} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';
import {useIsDesktop} from '@/lib/media';

// What is loaded and how the page answers while it is not: nothing yet, or
// the failure with a way to try again.
function Loaded<T>({
  state,
  children,
}: {
  state: {data: T | null; error: string | null; reload: () => void};
  children: (data: T) => ReactNode;
}) {
  const t = useMessages();

  if (state.error && !state.data) {
    return (
      <Notice
        message={state.error}
        actionLabel={t.common.retry}
        onAction={state.reload}
      />
    );
  }

  return state.data ? children(state.data) : null;
}

export function AdminOrganization() {
  const account = useAdminAccount();
  const refresh = useRefreshAccount();
  const switchMode = useSwitchMode();
  const confirmLeave = useConfirmLeave();
  const isDesktop = useIsDesktop();
  const t = useMessages();
  const passwordId = useId();
  const organization = useFocusLoad(adminLoad.organization);
  const admins = useFocusLoad(adminLoad.admins);
  const newestEvent = useFocusLoad(adminLoad.newestEvent);
  const {location, open: go, up: goUp} = useAdminLocation('organization');
  const [saved, setSaved] = useState<Part | null>(null);

  // Every change is in the history the next time it is opened.
  const reloadEvents = newestEvent.reload;
  const reloadAdmins = admins.reload;
  const adminsChanged = () => {
    reloadAdmins();
    reloadEvents();
  };

  // The languages decide which fields the rules have, and what the other
  // admin pages ask for.
  const savedFrom = (part: Part) => ({
    saved: saved === part,
    onSaved: () => {
      setSaved(part);
      organization.reload();
      reloadEvents();
      refresh();
    },
  });

  // "Sparat." is said on the page it was saved from, until another opens.
  const open = (page: Page | null) => {
    setSaved(null);
    go({tab: 'organization', step: page ?? 'overview'});
  };
  const up = () => {
    setSaved(null);
    goUp();
  };

  // The desktop always shows a page beside its menu, and the password on
  // the account's; the phone starts at the overview, which holds the
  // account, and opens the password from it.
  const page: Page | null =
    location.step === 'admin'
      ? 'admins'
      : location.step === 'overview'
        ? isDesktop
          ? 'details'
          : null
        : location.step === 'password' && isDesktop
          ? 'account'
          : location.step;
  const adminId = location.step === 'admin' ? location.id : null;
  const openedAdmin =
    adminId === null
      ? undefined
      : admins.data?.find((admin) => admin.id === adminId);
  const attention =
    admins.data?.filter((admin) => !admin.twoFactorEnabled).length ?? 0;

  const accountCard = (
    <Account
      signOutFrom={account.organizationName}
      onSignOut={signOut}
      switchTo={
        account.apartment === null
          ? null
          : {
              label: t.account.openBooking,
              route: 'book',
              onPress: () => switchMode('member'),
            }
      }
    >
      {isDesktop ? null : (
        <div className={`mt-2.5 ${LIST}`}>
          <ActionRow
            label={t.admin.organization.changePassword}
            onPress={() => open('password')}
          />
        </div>
      )}
    </Account>
  );

  let content: ReactNode;
  switch (page) {
    case null:
      content = (
        <Overview
          organization={organization.data}
          admins={admins.data}
          latest={newestEvent.data}
          onOpen={open}
          account={accountCard}
        />
      );
      break;
    case 'account':
      // As wide as the password's form under it.
      content = isDesktop ? (
        <div className='flex max-w-2xl flex-col'>
          {accountCard}
          <section aria-labelledby={passwordId}>
            <h2 id={passwordId} className={SECTION_LABEL}>
              {t.admin.organization.changePassword}
            </h2>
            <ChangePassword />
          </section>
        </div>
      ) : (
        accountCard
      );
      break;
    case 'details':
      // Saved elsewhere since it was opened: a form starts over from what
      // the server has, so a save cannot put the old values back. Each
      // form starts over only when its own part changed.
      content = (
        <Loaded state={organization}>
          {(data) => (
            <DetailsForm
              key={`${data.name}\n${data.bookingWindowDays}`}
              initial={data}
              {...savedFrom('details')}
            />
          )}
        </Loaded>
      );
      break;
    case 'languages':
      content = (
        <Loaded state={organization}>
          {(data) => (
            <LanguagesForm
              key={data.locales.join()}
              initial={data.locales}
              {...savedFrom('languages')}
            />
          )}
        </Loaded>
      );
      break;
    case 'rules':
      content = (
        <Loaded state={organization}>
          {(data) => (
            <RulesForm
              // Not the languages: a language saved meanwhile adds or
              // removes a field, and keeps what is being written in the
              // others.
              key={JSON.stringify(data.rulesText)}
              initial={data.rulesText}
              locales={data.locales}
              {...savedFrom('rules')}
            />
          )}
        </Loaded>
      );
      break;
    case 'admins':
      content = openedAdmin ? (
        <AdminDetail
          key={openedAdmin.id}
          admin={openedAdmin}
          onChanged={adminsChanged}
          onRemoved={up}
        />
      ) : adminId !== null ? (
        <Loaded state={admins}>
          {() => (admins.loading ? null : <Gone />)}
        </Loaded>
      ) : (
        <Loaded state={admins}>
          {(data) => (
            <Admins
              admins={data}
              onChanged={adminsChanged}
              onOpen={(admin) =>
                go({tab: 'organization', step: 'admin', id: admin.id})
              }
            />
          )}
        </Loaded>
      );
      break;
    case 'history':
      content = <History />;
      break;
    case 'password':
      content = <ChangePassword />;
      break;
  }

  const back =
    adminId !== null
      ? {label: t.admin.admins.title, onPress: up}
      : page !== null && !isDesktop
        ? {label: t.tabs.organization, onPress: up}
        : undefined;

  return (
    <AdminPage
      title={
        adminId !== null
          ? (openedAdmin?.name ??
            (admins.data && !admins.loading ? t.admin.goneTitle : ''))
          : page === null
            ? t.tabs.organization
            : organizationSectionTitle(page, t)
      }
      subtitle={account.organizationName}
      back={back}
      aside={
        isDesktop && page !== null ? (
          <PageMenu
            shown={page}
            attention={attention}
            onOpen={(next) => confirmLeave(() => open(next))}
          />
        ) : undefined
      }
    >
      {content}
    </AdminPage>
  );
}
