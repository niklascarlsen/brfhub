import {useAdminAccount} from '@brfhub/core/admin/account';
import {
  DURATIONS,
  durationOf,
  endsOnAfter,
  startOf,
} from '@brfhub/core/admin/announcement';
import {
  checkAnnouncement,
  failureMessage,
  type AnnouncementFields,
} from '@brfhub/core/admin/drafts';
import {fieldLabel, type Draft} from '@brfhub/core/admin/localized';
import {useProblems} from '@brfhub/core/admin/useProblems';
import {formatLongDate} from '@brfhub/core/lib/dates';
import {useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {SECONDARY_BUTTON, SECONDARY_LABEL} from '@/admin/styles';
import {FieldProblem} from '@/components/FieldProblem';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Icon} from '@/components/Icon';
import {useMessages} from '@/i18n/LocaleProvider';
import {theme} from '@/theme';

type AnnouncementFormProps = {
  initial: AnnouncementFields & {publishedOn: string};
  today: string;
  submitLabel: string;
  // A new announcement can be mailed too; an edit never is.
  offerMail?: boolean;
  onSubmit: (fields: AnnouncementFields, mail: boolean) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
};

export function AnnouncementForm({
  initial,
  today,
  submitLabel,
  offerMail = false,
  onSubmit,
  onCancel,
  onDelete,
}: AnnouncementFormProps) {
  const t = useMessages();
  const {locales} = useAdminAccount();
  const [title, setTitle] = useState<Draft>(initial.title);
  const [body, setBody] = useState<Draft>(initial.body);
  const [endsOn, setEndsOn] = useState(initial.endsOn);
  const [mail, setMail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A new duration counts from today, also when an older announcement is
  // given more days.
  const start = startOf(initial.publishedOn, today);
  const duration = durationOf(start, endsOn);
  const checked = checkAnnouncement({title, body, endsOn}, initial, locales, t);
  const {problem, leave, ready} = useProblems(checked);

  async function submit() {
    if (!ready()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(checked.value, mail);
    } catch (caught) {
      setError(failureMessage(caught, t));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-3'>
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          label={fieldLabel(
            t.admin.announcementForm.title,
            language,
            locales,
            t,
          )}
          value={title[language] ?? ''}
          onChangeText={(text) => setTitle({...title, [language]: text})}
          onBlur={() => leave(`title.${language}`)}
          problem={problem(`title.${language}`)}
          autoCapitalize='sentences'
        />
      ))}
      {locales.map((language) => {
        const label = fieldLabel(
          t.admin.announcementForm.body,
          language,
          locales,
          t,
        );

        const shown = problem(`body.${language}`);

        return (
          <View key={language}>
            <View className='gap-1.5'>
              <Text className='text-[13px] font-medium text-theme-muted'>
                {label}
              </Text>
              <TextInput
                value={body[language] ?? ''}
                onChangeText={(text) => setBody({...body, [language]: text})}
                onBlur={() => leave(`body.${language}`)}
                multiline
                textAlignVertical='top'
                accessibilityLabel={label}
                accessibilityHint={shown ?? undefined}
                className={`min-h-[132px] rounded-sm border bg-theme-surface px-4 py-3 text-base text-theme-ink ${
                  shown ? 'border-theme-danger' : 'border-theme-edge'
                }`}
                style={{
                  fontFamily: 'Merriweather_400Regular',
                  color: theme.ink,
                }}
              />
            </View>
            {shown ? <FieldProblem message={shown} /> : null}
          </View>
        );
      })}
      <View className='gap-2'>
        <Text className='text-[13px] font-medium text-theme-muted'>
          {t.admin.announcementForm.shownFor}
        </Text>
        <View className='flex-row flex-wrap gap-2'>
          {DURATIONS.map(({label, days}) => {
            const selected = duration === days;

            return (
              <Pressable
                key={String(days)}
                accessibilityState={{selected}}
                onPress={() =>
                  setEndsOn(days === null ? null : endsOnAfter(start, days))
                }
                className={`h-10 justify-center rounded-full border px-4 ${
                  selected
                    ? 'border-theme-ink bg-theme-ink'
                    : 'border-theme-edge bg-theme-surface active:bg-theme-sunk'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selected ? 'text-theme-surface' : 'text-theme-ink'
                  }`}
                >
                  {label(t)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          {t.admin.announcementForm.shown(
            formatLongDate(initial.publishedOn, t),
            endsOn ? formatLongDate(endsOn, t) : null,
          )}
        </Text>
      </View>
      {offerMail ? (
        <Pressable
          onPress={() => setMail(!mail)}
          accessibilityRole='checkbox'
          accessibilityState={{checked: mail}}
          accessibilityHint={t.admin.announcementForm.mailHint}
          className='flex-row items-start gap-2.5 self-start py-1'
        >
          <Icon
            name={mail ? 'checkbox' : 'square-outline'}
            size={22}
            color={mail ? theme.ink : theme.muted}
          />
          <View className='min-w-0 flex-1 gap-0.5'>
            <Text className='font-sans text-sm text-theme-ink'>
              {t.admin.announcementForm.mail}
            </Text>
            <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
              {t.admin.announcementForm.mailHint}
            </Text>
          </View>
        </Pressable>
      ) : null}
      {error ? (
        <Text
          accessibilityRole='alert'
          className='font-sans text-sm text-theme-ink'
        >
          {error}
        </Text>
      ) : null}
      <FormActions
        submitLabel={submitLabel}
        dirty={checked.changed}
        submitting={submitting}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      >
        {onDelete ? (
          <Pressable onPress={onDelete} className={SECONDARY_BUTTON}>
            <Text className={SECONDARY_LABEL}>{t.admin.remove}</Text>
          </Pressable>
        ) : null}
      </FormActions>
    </View>
  );
}
