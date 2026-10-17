import {changeDays} from '@brfhub/core/admin/change';
import {checkClosing, failureMessage} from '@brfhub/core/admin/drafts';
import {useAdminAccount} from '@brfhub/core/admin/account';
import type {Draft} from '@brfhub/core/admin/localized';
import {useProblems} from '@brfhub/core/admin/useProblems';
import type {LocalizedText} from '@brfhub/core/api/types';
import {useState} from 'react';
import {Text, View} from 'react-native';

import {ChangeDay} from '@/admin/ChangeDay';
import {FormActions} from '@/admin/FormActions';
import {useMessages} from '@/i18n/LocaleProvider';

type CloseFormProps = {
  // The resource's name, in the admin's language.
  name: string;
  today: string;
  freeFrom: string;
  // Resolves false when the admin keeps the bookings the closing would
  // cancel, and the form stays.
  onSubmit: (closesFrom: string, reason: LocalizedText) => Promise<boolean>;
  onCancel: () => void;
};

// Closes a resource from a day the admin picks, today at the earliest,
// such as when a machine breaks.
export function CloseForm({
  name,
  today,
  freeFrom,
  onSubmit,
  onCancel,
}: CloseFormProps) {
  const t = useMessages();
  const [closesFrom, setClosesFrom] = useState(
    () => changeDays('closing', today, freeFrom).chosen,
  );
  const {locales} = useAdminAccount();
  const [reason, setReason] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checked = checkClosing({reason}, locales, t);
  const {problem, leave, ready} = useProblems(checked);

  async function submit() {
    if (!ready()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (!(await onSubmit(closesFrom, checked.value.reason))) {
        setSubmitting(false);
      }
    } catch (caught) {
      setError(failureMessage(caught, t));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-4'>
      <Text className='font-sans text-sm leading-5 text-theme-ink'>
        {t.admin.closeForm.note(name)}
      </Text>
      <ChangeDay
        kind='closing'
        label={t.admin.closeForm.from}
        today={today}
        freeFrom={freeFrom}
        day={closesFrom}
        onDay={setClosesFrom}
        reason={reason}
        onReason={setReason}
        onReasonBlur={(language) => leave(`reason.${language}`)}
        reasonProblem={(language) => problem(`reason.${language}`)}
      />
      {error ? (
        <Text
          accessibilityRole='alert'
          className='font-sans text-sm text-theme-ink'
        >
          {error}
        </Text>
      ) : null}
      <FormActions
        submitLabel={t.admin.closeForm.save}
        dirty={Object.values(reason).some((text) => text?.trim())}
        ready
        submitting={submitting}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      />
    </View>
  );
}
