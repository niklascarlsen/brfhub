import {useAdminAccount} from '@booking/core/admin/account';
import {
  asksReason,
  changeDays,
  type ChangeKind,
} from '@booking/core/admin/change';
import {fieldLabel, type Draft} from '@booking/core/admin/localized';
import type {Locale} from '@booking/core/i18n/catalog';
import {formatLongDate} from '@booking/core/lib/dates';

import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

type ChangeDayProps = {
  kind: ChangeKind;
  label: string;
  today: string;
  freeFrom: string;
  day: string;
  onDay: (day: string) => void;
  reason: Draft;
  onReason: (reason: Draft) => void;
  onReasonBlur: (locale: Locale) => void;
  reasonProblem: (locale: Locale) => string | null;
};

// The day a change of times or a closing starts, and what it does to the
// bookings already made. New times that can cancel bookings ask why, for
// the apartments told; a closing always does, since the closed resource
// shows it to everyone. Written in each of the organization's languages.
export function ChangeDay({
  kind,
  label,
  today,
  freeFrom,
  day,
  onDay,
  reason,
  onReason,
  onReasonBlur,
  reasonProblem,
}: ChangeDayProps) {
  const t = useMessages();
  const {locales} = useAdminAccount();
  const {first, free} = changeDays(kind, today, freeFrom);
  const mayCancel = day < free;
  const closing = kind === 'closing';
  const asked = asksReason(kind, day, free);

  return (
    <div className='flex flex-col gap-3'>
      <div>
        <FloatingLabelInput
          type='date'
          label={label}
          required
          min={first}
          value={day}
          // A day cleared or typed before the first keeps the one chosen.
          onChange={(event) => {
            const next = event.target.value;
            if (next && next >= first) {
              onDay(next);
            }
          }}
        />
        <p className='mt-1.5 text-[13px] leading-5 text-theme-muted'>
          {mayCancel
            ? t.admin.change.mayCancel(formatLongDate(free, t))
            : t.admin.change.noCancels}
        </p>
      </div>
      {asked ? (
        <div className='flex flex-col gap-3'>
          {locales.map((language) => (
            <FloatingLabelInput
              key={language}
              lang={language}
              label={fieldLabel(
                closing ? t.admin.change.note : t.admin.change.reason,
                language,
                locales,
                t,
              )}
              value={reason[language] ?? ''}
              onChange={(event) =>
                onReason({...reason, [language]: event.target.value})
              }
              onBlur={() => onReasonBlur(language)}
              problem={reasonProblem(language)}
            />
          ))}
          <p className='-mt-1.5 text-[13px] leading-5 text-theme-muted'>
            {closing ? t.admin.change.noteHint : t.admin.change.reasonHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}
