import {useEffect, useState} from 'react';

import {api, unwrap, type Announcement} from '@/api/client';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';
import {readDismissed, saveDismissed} from '@/lib/dismissed';
import {formatDayMonth} from '@/lib/dates';

function fetchAnnouncements() {
  return unwrap(api.GET('/announcements'));
}

// Announcements are a courtesy on top of booking, so a failed load shows
// nothing rather than an error in the way.
function useAnnouncements(): Announcement[] {
  const {data} = useFocusLoad(fetchAnnouncements);
  return data ?? [];
}

// An edited announcement counts as new, so it shows again on a device
// that hid it.
function keyOf(announcement: Announcement): string {
  return `${announcement.id}:${announcement.updatedAt}`;
}

// The newest announcement the apartment has not hidden on this device.
export function AnnouncementBanner({className}: {className?: string}) {
  const announcements = useAnnouncements();
  const t = useMessages();
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    void readDismissed().then(setDismissed);
  }, []);

  const shown =
    dismissed === null
      ? undefined
      : announcements.find((item) => !dismissed.includes(keyOf(item)));

  if (!shown) {
    return null;
  }

  // Only what is still current is kept, so the list stays short.
  const hide = () => {
    const current = new Set(announcements.map(keyOf));
    const next = [
      keyOf(shown),
      ...(dismissed ?? []).filter((key) => current.has(key)),
    ];
    setDismissed(next);
    void saveDismissed(next);
  };

  return (
    <div className={className}>
      <section
        aria-label={t.announcements.heading}
        className='flex items-start gap-3 rounded-2xl border border-theme-line bg-theme-mist px-4.5 py-3.5'
      >
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <h2 className='text-[15px] font-semibold tracking-tight wrap-break-word text-theme-ink'>
            {shown.title}
          </h2>
          <p className='line-clamp-4 text-[13px] leading-5 whitespace-pre-line wrap-break-word text-theme-ink'>
            {shown.body}
          </p>
        </div>
        <button
          type='button'
          onClick={hide}
          className='-mr-1.5 shrink-0 rounded-full px-2 py-1 text-[13px] font-semibold text-theme-muted transition-colors hover:text-theme-ink'
        >
          {t.announcements.hide}
        </button>
      </section>
    </div>
  );
}

// Every current announcement, hidden ones too, for when the apartment
// wants to read one again.
export function AnnouncementList() {
  const announcements = useAnnouncements();
  const t = useMessages();

  if (announcements.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby='announcements-heading' className='mb-6.5'>
      <h2
        id='announcements-heading'
        className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
      >
        {t.announcements.heading}
      </h2>
      <div className='flex flex-col gap-2.5'>
        {announcements.map((announcement) => (
          <article
            key={announcement.id}
            className='flex flex-col gap-1 rounded-2xl border border-theme-line bg-theme-surface px-4.5 py-4'
          >
            <span className='text-xs text-theme-muted'>
              {formatDayMonth(announcement.publishedOn, t)}
            </span>
            <h3 className='text-[15px] font-semibold tracking-tight wrap-break-word text-theme-ink'>
              {announcement.title}
            </h3>
            <p className='text-[13px] leading-5 whitespace-pre-line wrap-break-word text-theme-ink'>
              {announcement.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
