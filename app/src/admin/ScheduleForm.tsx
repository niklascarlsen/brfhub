import {asksReason, changeDays} from '@brfhub/core/admin/change';
import {
  checkSchedule,
  failureMessage,
  type ScheduleChange,
} from '@brfhub/core/admin/drafts';
import {useAdminAccount} from '@brfhub/core/admin/account';
import type {Draft} from '@brfhub/core/admin/localized';
import {useProblems} from '@brfhub/core/admin/useProblems';
import type {SlotInput} from '@brfhub/core/api/types';
import {useState} from 'react';
import {Text, View} from 'react-native';

import {ChangeDay} from '@/admin/ChangeDay';
import {FormActions} from '@/admin/FormActions';
import {SlotsEditor} from '@/admin/SlotsEditor';
import {FieldProblem} from '@/components/FieldProblem';
import {useMessages} from '@/i18n/LocaleProvider';

type ScheduleFormProps = {
  initial: SlotInput[];
  today: string;
  freeFrom: string;
  // Resolves false when the admin keeps the bookings the change would
  // cancel, and the form stays.
  onSubmit: (validFrom: string, change: ScheduleChange) => Promise<boolean>;
  onCancel: () => void;
};

export function ScheduleForm({
  initial,
  today,
  freeFrom,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const t = useMessages();
  const [slots, setSlots] = useState(initial);
  const {free, chosen} = changeDays('schedule', today, freeFrom);
  const [validFrom, setValidFrom] = useState(chosen);
  const {locales} = useAdminAccount();
  const [reason, setReason] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A message is checked and sent only while the fields for it show.
  const checked = checkSchedule(
    {slots, reason: asksReason('schedule', validFrom, free) ? reason : {}},
    initial,
    locales,
    t,
  );
  const {problem, leave, ready} = useProblems(checked);
  const slotsProblem = problem('slots');

  async function submit() {
    if (!ready()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (!(await onSubmit(validFrom, checked.value))) {
        setSubmitting(false);
      }
    } catch (caught) {
      setError(failureMessage(caught, t));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-4'>
      <ChangeDay
        kind='schedule'
        label={t.admin.scheduleForm.from}
        today={today}
        freeFrom={freeFrom}
        day={validFrom}
        onDay={setValidFrom}
        reason={reason}
        onReason={setReason}
        onReasonBlur={(language) => leave(`reason.${language}`)}
        reasonProblem={(language) => problem(`reason.${language}`)}
      />
      <View>
        <SlotsEditor slots={slots} onChange={setSlots} />
        {slotsProblem ? <FieldProblem message={slotsProblem} /> : null}
      </View>
      {error ? (
        <Text
          accessibilityRole='alert'
          className='font-sans text-sm text-theme-ink'
        >
          {error}
        </Text>
      ) : null}
      <FormActions
        submitLabel={t.admin.scheduleForm.save}
        dirty={checked.changed}
        submitting={submitting}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      />
    </View>
  );
}
