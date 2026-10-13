import type {AdminEvent} from '../api/types';
import type {Messages} from '../i18n/catalog';

// What an event reads as, in the language shown: "Tog bort lägenhet 12".
export function describeEvent(event: AdminEvent, t: Messages): string {
  return t.admin.events.actions[event.action](event.subject);
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
