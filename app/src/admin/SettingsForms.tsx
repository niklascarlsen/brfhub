import type {SettingsUpdate} from '@brfhub/core/admin/actions';
import {
  checkDetails,
  checkRules,
  failureMessage,
  isSame,
} from '@brfhub/core/admin/drafts';
import type {Draft} from '@brfhub/core/admin/localized';
import {useProblems} from '@brfhub/core/admin/useProblems';
import type {LocalizedText} from '@brfhub/core/api/types';
import {CATALOGS, LOCALES, type Locale} from '@brfhub/core/i18n/catalog';
import {useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {Note, Status} from '@/admin/FormText';
import {FieldProblem} from '@/components/FieldProblem';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useMessages} from '@/i18n/LocaleProvider';
import {theme} from '@/theme';

// The organization's settings, a form per part, each saved on its own.
export type Part = 'details' | 'languages' | 'rules';

type PartProps = {
  // Saved from this form since the page opened. The form starts over from
  // what the server has once saved, so the parent remembers it.
  saved: boolean;
  onSaved: () => void;
};

// Says whether it was saved, so the form can take what it sent as saved
// before the server's copy comes back.
function useSave(onSaved: () => void) {
  const t = useMessages();
  const actions = useAdminActions(onSaved);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const save = async (body: SettingsUpdate): Promise<boolean> => {
    setError(null);
    setSubmitting(true);
    try {
      await actions.organization.save(body);
      setSubmitting(false);
      return true;
    } catch (caught) {
      setError(failureMessage(caught, t));
      setSubmitting(false);
      return false;
    }
  };

  return {error, submitting, save};
}

export function DetailsForm({
  initial,
  saved,
  onSaved,
}: PartProps & {initial: {name: string; bookingWindowDays: number}}) {
  const t = useMessages();
  const [name, setName] = useState(initial.name);
  const [days, setDays] = useState(String(initial.bookingWindowDays));
  const [stored, setStored] = useState({
    name: initial.name,
    bookingWindowDays: initial.bookingWindowDays,
  });
  const {error, submitting, save} = useSave(onSaved);
  const checked = checkDetails({name, days}, stored, t);
  const {problem, leave, ready} = useProblems(checked);

  const submit = () => {
    if (!ready()) {
      return;
    }

    const sent = checked.value;
    void save(sent).then((done) => done && setStored(sent));
  };

  return (
    <View className='gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.name}
        value={name}
        onChangeText={setName}
        onBlur={() => leave('name')}
        problem={problem('name')}
      />
      <View className='gap-2'>
        <FloatingLabelInput
          label={t.admin.organization.windowDays}
          value={days}
          onChangeText={setDays}
          onBlur={() => leave('days')}
          problem={problem('days')}
          keyboardType='number-pad'
        />
        <Note>{t.admin.organization.windowNote}</Note>
      </View>
      <Status
        message={
          // Said until the form is edited again.
          error ??
          (saved && !checked.changed ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={checked.changed}
        submitting={submitting}
        onSubmit={submit}
      />
    </View>
  );
}

export function LanguagesForm({
  initial,
  saved,
  onSaved,
}: PartProps & {initial: Locale[]}) {
  const t = useMessages();
  const [locales, setLocales] = useState(initial);
  const [stored, setStored] = useState(initial);
  const {error, submitting, save} = useSave(onSaved);
  const dirty = !isSame(locales, stored);

  return (
    <View className='gap-4'>
      <View className='gap-2.5'>
        <View className='flex-row flex-wrap gap-2'>
          {LOCALES.map((language) => {
            const selected = locales.includes(language);

            return (
              <Pressable
                key={language}
                accessibilityRole='button'
                accessibilityState={{selected}}
                // The organization writes in at least one language.
                disabled={selected && locales.length === 1}
                onPress={() =>
                  setLocales(
                    LOCALES.filter((item) =>
                      item === language ? !selected : locales.includes(item),
                    ),
                  )
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
                  {CATALOGS[language].language.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Note>{t.admin.organization.languagesNote}</Note>
      </View>
      <Status
        message={
          // Said until the form is edited again.
          error ?? (saved && !dirty ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={dirty}
        submitting={submitting}
        onSubmit={() =>
          void save({locales}).then((done) => done && setStored(locales))
        }
      />
    </View>
  );
}

export function RulesForm({
  initial,
  locales,
  saved,
  onSaved,
}: PartProps & {initial: LocalizedText; locales: Locale[]}) {
  const t = useMessages();
  const [rulesText, setRulesText] = useState<Draft>(initial);
  const [stored, setStored] = useState<Draft>(initial);
  const {error, submitting, save} = useSave(onSaved);
  const checked = checkRules(rulesText, stored, locales, t);
  const {problem, leave, ready} = useProblems(checked);

  const submit = () => {
    if (!ready()) {
      return;
    }

    const rules = checked.value;
    void save({rulesText: rules}).then((done) => done && setStored(rules));
  };

  return (
    <View className='gap-4'>
      {locales.map((language) => {
        // One field needs no name under the heading; more are named by
        // their language, as the languages above are.
        const label =
          locales.length > 1
            ? CATALOGS[language].language.name
            : t.admin.organization.rules;
        const shown = problem(`rules.${language}`);

        return (
          <View key={language}>
            <View className='gap-2'>
              {locales.length > 1 ? (
                <Text className='text-[13px] font-medium text-theme-muted'>
                  {label}
                </Text>
              ) : null}
              <TextInput
                value={rulesText[language] ?? ''}
                onChangeText={(text) =>
                  setRulesText({...rulesText, [language]: text})
                }
                onBlur={() => leave(`rules.${language}`)}
                multiline
                textAlignVertical='top'
                placeholder={t.admin.organization.rulesPlaceholder}
                placeholderTextColor={theme.faint}
                accessibilityLabel={label}
                accessibilityHint={shown ?? undefined}
                className={`min-h-[132px] rounded-sm border bg-theme-surface px-4 py-3 text-base leading-6 text-theme-ink ${
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
      <Note>{t.admin.organization.rulesNote}</Note>
      <Status
        message={
          // Said until the form is edited again.
          error ??
          (saved && !checked.changed ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={checked.changed}
        submitting={submitting}
        onSubmit={submit}
      />
    </View>
  );
}
