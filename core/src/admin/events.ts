import type {AdminEvent} from '../api/types';
import {CATALOGS, joinNames, type Messages} from '../i18n/catalog';
import {formatDayHeading, toIsoDate} from '../lib/dates';

// What the history can be narrowed to: the admin tab, or the part of the
// organization's page, that the change was made on.
export const EVENT_AREAS = [
  'apartments',
  'resources',
  'announcements',
  'admins',
  'organization',
] as const;

export type EventArea = (typeof EVENT_AREAS)[number];

const AREA_OF: Record<AdminEvent['action'], EventArea> = {
  'apartment.create': 'apartments',
  'apartment.update': 'apartments',
  'apartment.newResident': 'apartments',
  'apartment.signOut': 'apartments',
  'apartment.remove': 'apartments',
  'admin.add': 'admins',
  'admin.remove': 'admins',
  'admin.resetTwoFactor': 'admins',
  'kind.create': 'resources',
  'kind.update': 'resources',
  'kind.remove': 'resources',
  'resource.create': 'resources',
  'resource.update': 'resources',
  'resource.order': 'resources',
  'resource.close': 'resources',
  'resource.reopen': 'resources',
  'schedule.put': 'resources',
  'schedule.remove': 'resources',
  'announcement.create': 'announcements',
  'announcement.update': 'announcements',
  'announcement.remove': 'announcements',
  'organization.update': 'organization',
};

export function eventArea(event: AdminEvent): EventArea {
  return AREA_OF[event.action];
}

// What an event reads as, in the language shown: "Tog bort lägenhet 12".
export function describeEvent(event: AdminEvent, t: Messages): string {
  return t.admin.events.actions[event.action](subjectOf(event, t));
}

type SettingsPart = keyof Messages['admin']['events']['settingsParts'];

// A part by its key, or by the name it had in any language: events written
// before the parts were keys named them in the actor's language.
const SETTINGS_PARTS = new Map<string, SettingsPart>(
  Object.values(CATALOGS).flatMap((catalog) =>
    Object.entries(catalog.admin.events.settingsParts).flatMap(
      ([key, name]) => [
        [key, key as SettingsPart],
        [name, key as SettingsPart],
      ],
    ),
  ),
);

// A change to the settings names the parts it touched, in the language
// shown. A subject not made of parts reads as it was written.
function subjectOf(event: AdminEvent, t: Messages): string {
  if (event.action !== 'organization.update') {
    return event.subject;
  }

  const parts = event.subject
    .split(',')
    .map((part) => SETTINGS_PARTS.get(part.trim()));

  return parts.every((part) => part !== undefined)
    ? joinNames(
        parts.map((part) => t.admin.events.settingsParts[part]),
        t,
      )
    : event.subject;
}

// Who did it: the admin's name while they are one, else the address they
// had.
export function eventActor(event: AdminEvent): string {
  return event.actorName ?? event.actor;
}

// When it happened, in the device's own zone: the admins read it where
// they are.
export function formatEventTime(at: string, t: Messages): string {
  return new Date(at).toLocaleString(t.dates.locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// The time alone, under a heading that says the day.
export function formatEventClock(at: string, t: Messages): string {
  return new Date(at).toLocaleTimeString(t.dates.locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type EventDay = {
  day: string;
  heading: string;
  events: AdminEvent[];
};

// The events under a heading per day, in the device's zone as the times
// are: today, yesterday, then the date, with its year once it is not this
// one. Keeps the order they come in, newest first.
export function groupEventsByDay(
  events: AdminEvent[],
  t: Messages,
  now = new Date(),
): EventDay[] {
  const today = toIsoDate(now);
  const yesterday = toIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
  const days: EventDay[] = [];

  for (const event of events) {
    const day = toIsoDate(new Date(event.at));
    const last = days.at(-1);

    if (last?.day === day) {
      last.events.push(event);
      continue;
    }

    let heading: string;
    if (day === today) {
      heading = t.dates.today;
    } else if (day === yesterday) {
      heading = t.dates.yesterday;
    } else if (day.slice(0, 4) === today.slice(0, 4)) {
      heading = formatDayHeading(day, t);
    } else {
      heading = `${formatDayHeading(day, t)} ${day.slice(0, 4)}`;
    }

    days.push({day, heading, events: [event]});
  }

  return days;
}
