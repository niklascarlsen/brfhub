import type {Announcement} from '@booking/core/api/types';
import {formatDayMonth} from '@booking/core/lib/dates';
import {useEffect, useState} from 'react';

import {api, unwrap} from '@/api/client';
import {MegaphoneOutlineIcon} from '@/components/icons';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';
import {readDismissed, saveDismissed} from '@/lib/dismissed';

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

// How far each announcement waiting behind the shown one peeks out, and
// its solid tone, a step darker the further back it is.
const PEEK = {down: 8, inset: 14};
const PEEK_TONE: Record<number, string> = {
  1: 'bg-theme-notice-under',
  2: 'bg-theme-notice-back',
};

// The megaphone and the day it went up, which sets a notice apart from the
// rules around it. With more than one waiting, the banner also tells that
// more are behind.
function NoticeDate({
  publishedOn,
  waiting = 1,
}: {
  publishedOn: string;
  waiting?: number;
}) {
  const t = useMessages();
  const day = formatDayMonth(publishedOn, t);

  return (
    <span className='flex items-center gap-1.5 text-xs font-semibold text-theme-notice-ink tabular-nums'>
      <MegaphoneOutlineIcon size={14} />
      {waiting > 1 ? t.announcements.withPosition(day, 1, waiting) : day}
    </span>
  );
}

// The newest announcement the apartment has not hidden on this device,
// with up to two edges below it when more are waiting.
export function AnnouncementBanner({className}: {className?: string}) {
  const announcements = useAnnouncements();
  const t = useMessages();
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    void readDismissed().then(setDismissed);
  }, []);

  const waiting =
    dismissed === null
      ? []
      : announcements.filter((item) => !dismissed.includes(keyOf(item)));
  const shown = waiting[0];
  const behind = Math.min(waiting.length - 1, 2);

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
      <div className='relative' style={{paddingBottom: behind * PEEK.down}}>
        {[2, 1]
          .filter((depth) => depth <= behind)
          .map((depth) => (
            <div
              key={depth}
              aria-hidden
              className={`absolute rounded-2xl border border-theme-notice-line ${PEEK_TONE[depth]}`}
              style={{
                top: depth * PEEK.down,
                bottom: (behind - depth) * PEEK.down,
                left: depth * PEEK.inset,
                right: depth * PEEK.inset,
              }}
            />
          ))}
        <section
          aria-label={t.announcements.heading}
          className='relative flex items-start gap-3 rounded-2xl border border-theme-notice-line bg-theme-notice px-4.5 py-3.5'
        >
          <div className='flex min-w-0 flex-1 flex-col gap-1'>
            <NoticeDate
              publishedOn={shown.publishedOn}
              waiting={waiting.length}
            />
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
            className='flex flex-col gap-1 rounded-2xl border border-theme-notice-line bg-theme-notice px-4.5 py-4'
          >
            <NoticeDate publishedOn={announcement.publishedOn} />
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
