import type {Api} from '../api/createApi';
import {codeOf, errorMessage, type ClientErrorCode} from '../api/errors';
import type {AdminResource, Apartment, LocalizedText} from '../api/types';
import type {Locale, Messages} from '../i18n/catalog';
import {formatLongDate} from '../lib/dates';
import type {Dialog} from '../lib/dialog';
import type {
  AnnouncementFields,
  ApartmentFields,
  KindFields,
  ResourceFields,
} from './drafts';

// A failure that means what the screen shows is out of date: the thing is
// gone, a resource took the kind meanwhile, or the day moved on.
function shouldReload(code: ClientErrorCode) {
  switch (code) {
    case 'NOT_FOUND':
    case 'KIND_IN_USE':
    case 'CHANGE_INSIDE_WINDOW':
      return true;
    default:
      return false;
  }
}

// Each part of the organization's settings is saved on its own, so a save
// sends only what its own form shows.
export type SettingsUpdate = {
  name?: string;
  bookingWindowDays?: number;
  locales?: Locale[];
  rulesText?: LocalizedText;
};

// What the admin screens load. Kept apart from the actions, which reload
// what these load.
export function adminLoads({api, unwrap}: Api) {
  return {
    apartments: () => unwrap(api.GET('/admin/apartments')),
    announcements: () => unwrap(api.GET('/admin/announcements')),
    resources: () => unwrap(api.GET('/admin/resources')),
    organization: () => unwrap(api.GET('/admin/organization')),
  };
}

type AdminActionsOptions = Api & {
  dialog: Dialog;
  t: Messages;
  // Runs after a change, and after a failure that means what is shown is
  // out of date.
  onChange?: () => void;
  // Told when a button's request goes out and when it is answered, so the
  // screen can hold its buttons meanwhile.
  onBusy?: (busy: boolean) => void;
};

// Asks before what an admin screen does where it should, sends it, tells
// why when it fails and reports the change. A form shows its own failure,
// so what a form saves throws instead. Each client binds it in
// useAdminActions.
export function adminActions({
  api,
  unwrap,
  dialog,
  t,
  onChange,
  onBusy,
}: AdminActionsOptions) {
  async function save<T>(request: () => Promise<T>): Promise<T> {
    const data = await request();
    onChange?.();
    return data;
  }

  async function mutate<T>(
    failTitle: string,
    request: () => Promise<T>,
    then?: (data: T) => void,
  ) {
    let data: T;

    onBusy?.(true);
    try {
      data = await request();
    } catch (error) {
      onBusy?.(false);
      const code = codeOf(error);
      if (shouldReload(code)) {
        onChange?.();
      }
      dialog.alert(failTitle, errorMessage(code, t));
      return;
    }

    onBusy?.(false);
    onChange?.();
    then?.(data);
  }

  const apartments = {
    create: (fields: ApartmentFields) =>
      save(() => unwrap(api.POST('/admin/apartments', {body: fields}))),

    update: (id: string, fields: ApartmentFields) =>
      save(() =>
        unwrap(
          api.PATCH('/admin/apartments/{id}', {
            params: {path: {id}},
            body: fields,
          }),
        ),
      ),

    // The apartment keeps its number and its bookings go.
    newResident: (
      id: string,
      {residentName, email}: Omit<ApartmentFields, 'label'>,
    ) =>
      save(() =>
        unwrap(
          api.POST('/admin/apartments/{id}/new-resident', {
            params: {path: {id}},
            body: {residentName, email},
          }),
        ),
      ),

    // Every device signed in as the apartment has to sign in again, after
    // a phone has gone missing.
    confirmSignOut: (apartment: Apartment) =>
      dialog.confirm(
        t.admin.apartment.signOut,
        t.admin.apartment.signOutQuestion(apartment.label),
        {
          label: t.account.signOut,
          onPress: () => {
            void mutate(t.admin.apartment.signOutFailed, () =>
              unwrap(
                api.POST('/admin/apartments/{id}/sign-out', {
                  params: {path: {id: apartment.id}},
                }),
              ),
            );
          },
        },
      ),

    confirmRemove: (apartment: Apartment, onRemoved: () => void) =>
      dialog.confirm(
        t.admin.apartment.remove,
        t.admin.apartment.removeQuestion(
          t.admin.apartment.cancelNote(apartment.upcomingBookings),
        ),
        {
          label: t.admin.remove,
          destructive: true,
          onPress: () => {
            void mutate(
              t.admin.apartment.removeFailed,
              () =>
                unwrap(
                  api.DELETE('/admin/apartments/{id}', {
                    params: {path: {id: apartment.id}},
                  }),
                ),
              onRemoved,
            );
          },
        },
      ),
  };

  const announcements = {
    create: (fields: AnnouncementFields) =>
      save(() => unwrap(api.POST('/admin/announcements', {body: fields}))),

    update: (id: string, fields: AnnouncementFields) =>
      save(() =>
        unwrap(
          api.PUT('/admin/announcements/{id}', {
            params: {path: {id}},
            body: fields,
          }),
        ),
      ),

    // The title is the one shown, in the admin's language.
    confirmRemove: (id: string, title: string, onRemoved: () => void) =>
      dialog.confirm(
        t.admin.announcements.remove,
        t.admin.announcements.removeQuestion(title),
        {
          label: t.admin.remove,
          destructive: true,
          onPress: () => {
            void mutate(
              t.admin.announcements.removeFailed,
              () =>
                unwrap(
                  api.DELETE('/admin/announcements/{id}', {
                    params: {path: {id}},
                  }),
                ),
              onRemoved,
            );
          },
        },
      ),
  };

  const kinds = {
    create: (fields: KindFields) =>
      save(() => unwrap(api.POST('/admin/kinds', {body: fields}))),

    update: (id: string, fields: KindFields) =>
      save(() =>
        unwrap(
          api.PATCH('/admin/kinds/{id}', {params: {path: {id}}, body: fields}),
        ),
      ),

    // Only a kind no resource uses can be removed, and nothing hangs on
    // it, so it goes without asking.
    remove: (id: string, onRemoved: () => void) =>
      mutate(
        t.admin.resources.removeKindFailed,
        () => unwrap(api.DELETE('/admin/kinds/{id}', {params: {path: {id}}})),
        onRemoved,
      ),
  };

  const resources = {
    create: (fields: ResourceFields) =>
      save(() => unwrap(api.POST('/admin/resources', {body: fields}))),

    // The times change through the schedule, not here.
    update: (id: string, {name, kindId, tags}: Omit<ResourceFields, 'slots'>) =>
      save(() =>
        unwrap(
          api.PATCH('/admin/resources/{id}', {
            params: {path: {id}},
            body: {name, kindId, tags},
          }),
        ),
      ),

    saveSchedule: (
      id: string,
      validFrom: string,
      slots: ResourceFields['slots'],
    ) =>
      save(() =>
        unwrap(
          api.PUT('/admin/resources/{id}/schedule', {
            params: {path: {id}},
            body: {validFrom, slots},
          }),
        ),
      ),

    // Members see the resources grouped by kind, so a move swaps places
    // with the neighbour of the same kind, and past the end does nothing.
    move: (all: AdminResource[], resource: AdminResource, by: -1 | 1) => {
      const siblings = all.filter((item) => item.kindId === resource.kindId);
      const position = siblings.findIndex((item) => item.id === resource.id);
      const neighbour = siblings[position + by];

      if (!neighbour) {
        return;
      }

      const ids = all.map((item) =>
        item.id === resource.id
          ? neighbour.id
          : item.id === neighbour.id
            ? resource.id
            : item.id,
      );

      void mutate(t.admin.resource.moveFailed, () =>
        unwrap(api.PUT('/admin/resources/order', {body: {ids}})),
      );
    },

    confirmRemoveChange: (id: string, validFrom: string) =>
      dialog.confirm(
        t.admin.resource.removeChange,
        t.admin.resource.removeChangeQuestion(formatLongDate(validFrom, t)),
        {
          label: t.admin.remove,
          destructive: true,
          onPress: () => {
            void mutate(t.admin.resource.removeChangeFailed, () =>
              unwrap(
                api.DELETE('/admin/resources/{id}/schedule/{validFrom}', {
                  params: {path: {id, validFrom}},
                }),
              ),
            );
          },
        },
      ),

    // Closes from the first day a change may start on. The name is the one
    // shown, in the admin's language.
    confirmClose: (id: string, name: string, closesFrom: string) =>
      dialog.confirm(
        t.admin.resource.close,
        t.admin.resource.closeQuestion(name, formatLongDate(closesFrom, t)),
        {
          label: t.admin.resource.closeAction,
          destructive: true,
          onPress: () => {
            void mutate(t.admin.resource.closeFailed, () =>
              unwrap(
                api.PUT('/admin/resources/{id}/closing', {
                  params: {path: {id}},
                  body: {closesFrom},
                }),
              ),
            );
          },
        },
      ),

    // Opens a closed resource again, or takes back a closing still ahead.
    reopen: (id: string, closed: boolean) =>
      mutate(
        closed
          ? t.admin.resource.reopenFailed
          : t.admin.resource.undoCloseFailed,
        () =>
          unwrap(
            api.DELETE('/admin/resources/{id}/closing', {
              params: {path: {id}},
            }),
          ),
      ),
  };

  const organization = {
    save: (body: SettingsUpdate) =>
      save(() => unwrap(api.PATCH('/admin/organization', {body}))),
  };

  return {apartments, announcements, kinds, resources, organization};
}

export type AdminActions = ReturnType<typeof adminActions>;
