import type {Api} from '../api/createApi';
import {codeOf, errorMessage, type ClientErrorCode} from '../api/errors';
import type {
  AdminResource,
  AdminUser,
  Apartment,
  CancelledBooking,
  EventArea,
  LocalizedText,
} from '../api/types';
import type {Locale, Messages} from '../i18n/catalog';
import {formatLongDate} from '../lib/dates';
import type {Dialog} from '../lib/dialog';
import {cancelsMessage} from './change';
import type {
  AdminFields,
  AnnouncementFields,
  ApartmentFields,
  KindFields,
  ResourceFields,
} from './drafts';

// A failure that means what the screen shows is out of date: the thing is
// gone, a resource took the kind meanwhile, the day moved on, or an
// apartment booked meanwhile.
function shouldReload(code: ClientErrorCode) {
  switch (code) {
    case 'NOT_FOUND':
    case 'KIND_IN_USE':
    case 'CHANGE_TOO_EARLY':
    case 'CHANGE_CANCELS_BOOKINGS':
    case 'RESOURCE_OPEN':
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
    admins: () => unwrap(api.GET('/admin/admins')),
    // A page of the history, from the newest or after an event.
    events: (area: EventArea | null, after?: string) =>
      unwrap(
        api.GET('/admin/events', {
          params: {query: {area: area ?? undefined, after}},
        }),
      ),
    // The newest event alone, for the line that says what happened last.
    newestEvent: () =>
      unwrap(api.GET('/admin/events', {params: {query: {limit: 1}}})),
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
  // Reloads what is shown when a failure says it is out of date, and
  // passes the failure on.
  async function reloadingIfStale<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      if (shouldReload(codeOf(error))) {
        onChange?.();
      }
      throw error;
    }
  }

  async function save<T>(request: () => Promise<T>): Promise<T> {
    const data = await reloadingIfStale(request);
    onChange?.();
    return data;
  }

  function fail(failTitle: string, error: unknown) {
    const code = codeOf(error);
    if (shouldReload(code)) {
      onChange?.();
    }
    dialog.alert(failTitle, errorMessage(code, t));
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
      fail(failTitle, error);
      return;
    }

    onBusy?.(false);
    onChange?.();
    then?.(data);
  }

  type Change =
    | {change: 'schedule'; validFrom: string; slots: ResourceFields['slots']}
    | {change: 'closing'; closesFrom: string}
    | {change: 'removeSchedule'; validFrom: string};

  // The bookings a change would cancel, as the server would make it now.
  async function cancelsOf(id: string, change: Change) {
    const {cancels} = await reloadingIfStale(() =>
      unwrap(
        api.POST('/admin/resources/{id}/preview', {
          params: {path: {id}},
          body: change,
        }),
      ),
    );
    return cancels;
  }

  // Asks before a change that cancels bookings, naming each. Resolves the
  // ones agreed to, or null when the admin keeps them.
  function agreeToCancel(
    cancels: CancelledBooking[],
    label: string,
  ): Promise<string[] | null> {
    if (cancels.length === 0) {
      return Promise.resolve([]);
    }

    return new Promise((resolve) => {
      dialog.confirm(
        t.admin.change.cancelTitle(cancels.length),
        cancelsMessage(cancels, t),
        {
          label,
          destructive: true,
          onPress: () => resolve(cancels.map((booking) => booking.id)),
          onDismiss: () => resolve(null),
        },
      );
    });
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

  const admins = {
    add: (fields: AdminFields) =>
      save(() => unwrap(api.POST('/admin/admins', {body: fields}))),

    confirmRemove: (admin: AdminUser, onRemoved?: () => void) =>
      dialog.confirm(
        t.admin.admins.removeAdmin,
        t.admin.admins.removeQuestion(admin.email),
        {
          label: t.admin.remove,
          destructive: true,
          onPress: () => {
            void mutate(
              t.admin.admins.removeFailed,
              () =>
                unwrap(
                  api.DELETE('/admin/admins/{id}', {
                    params: {path: {id: admin.id}},
                  }),
                ),
              onRemoved,
            );
          },
        },
      ),

    confirmResetTwoFactor: (admin: AdminUser) =>
      dialog.confirm(
        t.admin.admins.resetTwoFactor,
        t.admin.admins.resetQuestion(admin.email),
        {
          label: t.admin.admins.reset,
          onPress: () => {
            void mutate(t.admin.admins.resetFailed, () =>
              unwrap(
                api.POST('/admin/admins/{id}/reset-two-factor', {
                  params: {path: {id: admin.id}},
                }),
              ),
            );
          },
        },
      ),
  };

  const announcements = {
    // Mailed to every resident too when the admin asks, on publishing only.
    create: (fields: AnnouncementFields, mail: boolean) =>
      save(() =>
        unwrap(api.POST('/admin/announcements', {body: {...fields, mail}})),
      ),

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

    // New times from a day the admin picks. The bookings they cancel are
    // agreed to first; resolves false when the admin keeps them.
    saveSchedule: async (
      id: string,
      validFrom: string,
      slots: ResourceFields['slots'],
      reason: LocalizedText,
    ) => {
      const cancels = await agreeToCancel(
        await cancelsOf(id, {change: 'schedule', validFrom, slots}),
        t.admin.change.cancelAndSave,
      );

      if (cancels === null) {
        return false;
      }

      await save(() =>
        unwrap(
          api.PUT('/admin/resources/{id}/schedule', {
            params: {path: {id}},
            body: {validFrom, slots, cancels, reason},
          }),
        ),
      );
      return true;
    },

    // Closes from a day the admin picks, today at the earliest, the same
    // way.
    close: async (id: string, closesFrom: string, reason: LocalizedText) => {
      const cancels = await agreeToCancel(
        await cancelsOf(id, {change: 'closing', closesFrom}),
        t.admin.change.cancelAndClose,
      );

      if (cancels === null) {
        return false;
      }

      await save(() =>
        unwrap(
          api.PUT('/admin/resources/{id}/closing', {
            params: {path: {id}},
            body: {closesFrom, cancels, reason},
          }),
        ),
      );
      return true;
    },

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

    // The times before the change apply again, which can cancel what was
    // booked on its own; the question then names those bookings.
    confirmRemoveChange: async (id: string, validFrom: string) => {
      let cancels: CancelledBooking[];

      onBusy?.(true);
      try {
        cancels = await cancelsOf(id, {change: 'removeSchedule', validFrom});
      } catch (error) {
        onBusy?.(false);
        dialog.alert(
          t.admin.resource.removeChangeFailed,
          errorMessage(codeOf(error), t),
        );
        return;
      }
      onBusy?.(false);

      const question = t.admin.resource.removeChangeQuestion(
        formatLongDate(validFrom, t),
      );

      dialog.confirm(
        cancels.length === 0
          ? t.admin.resource.removeChange
          : t.admin.change.cancelTitle(cancels.length),
        cancels.length === 0
          ? question
          : `${question}\n\n${cancelsMessage(cancels, t)}`,
        {
          label:
            cancels.length === 0
              ? t.admin.remove
              : t.admin.change.cancelAndRemove,
          destructive: true,
          onPress: () => {
            void mutate(t.admin.resource.removeChangeFailed, () =>
              unwrap(
                api.DELETE('/admin/resources/{id}/schedule/{validFrom}', {
                  params: {path: {id, validFrom}},
                  body: {cancels: cancels.map((booking) => booking.id)},
                }),
              ),
            );
          },
        },
      );
    },

    // A closed resource goes for good, with what was booked on it. The
    // name is the one shown, in the admin's language.
    confirmRemove: (id: string, name: string, onRemoved: () => void) =>
      dialog.confirm(
        t.admin.resource.remove,
        t.admin.resource.removeQuestion(name),
        {
          label: t.admin.remove,
          destructive: true,
          onPress: () => {
            void mutate(
              t.admin.resource.removeFailed,
              () =>
                unwrap(
                  api.DELETE('/admin/resources/{id}', {params: {path: {id}}}),
                ),
              onRemoved,
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

  return {apartments, admins, announcements, kinds, resources, organization};
}

export type AdminActions = ReturnType<typeof adminActions>;
