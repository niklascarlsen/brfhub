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
import {limits} from '@brfhub/core/generated/limits';
import {CATALOGS, LOCALES, type Locale} from '@brfhub/core/i18n/catalog';
import {useId, useState, type SubmitEvent} from 'react';

import {FormActions} from '@/admin/FormActions';
import {Note, Status} from '@/admin/FormText';
import {FieldProblem} from '@/components/FieldProblem';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useMessages} from '@/i18n/LocaleProvider';

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
  const {minimum, maximum} = limits.UpdateOrganizationBody.bookingWindowDays;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!ready()) {
      return;
    }

    const sent = checked.value;
    void save(sent).then((done) => done && setStored(sent));
  };

  return (
    <form noValidate onSubmit={submit} className='flex flex-col gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.name}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => leave('name')}
        problem={problem('name')}
      />
      <div className='flex flex-col gap-2'>
        <FloatingLabelInput
          label={t.admin.organization.windowDays}
          type='number'
          inputMode='numeric'
          min={minimum}
          max={maximum}
          required
          value={days}
          onChange={(event) => setDays(event.target.value)}
          onBlur={() => leave('days')}
          problem={problem('days')}
        />
        <Note>{t.admin.organization.windowNote}</Note>
      </div>
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
      />
    </form>
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

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save({locales}).then((done) => done && setStored(locales));
  };

  return (
    <form onSubmit={submit} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2.5'>
        <div className='flex flex-wrap gap-2'>
          {LOCALES.map((language) => {
            const selected = locales.includes(language);

            return (
              <button
                key={language}
                type='button'
                lang={language}
                aria-pressed={selected}
                // The organization writes in at least one language.
                disabled={selected && locales.length === 1}
                onClick={() =>
                  setLocales(
                    LOCALES.filter((item) =>
                      item === language ? !selected : locales.includes(item),
                    ),
                  )
                }
                className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-theme-ink bg-theme-ink text-theme-surface'
                    : 'border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
                }`}
              >
                {CATALOGS[language].language.name}
              </button>
            );
          })}
        </div>
        <Note>{t.admin.organization.languagesNote}</Note>
      </div>
      <Status
        message={error ?? (saved && !dirty ? t.admin.organization.saved : null)}
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={dirty}
        submitting={submitting}
      />
    </form>
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
  const formId = useId();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!ready()) {
      return;
    }

    const rules = checked.value;
    void save({rulesText: rules}).then((done) => done && setStored(rules));
  };

  return (
    <form noValidate onSubmit={submit} className='flex flex-col gap-4'>
      {locales.map((language) => {
        const shown = problem(`rules.${language}`);
        const problemId = `${formId}-${language}`;

        return (
          <div key={language}>
            <label className='flex flex-col gap-2'>
              {/* One field needs no name under the heading; more are named
                  by their language, as the languages above are. */}
              <span
                className={
                  locales.length > 1
                    ? 'text-[13px] font-medium text-theme-muted'
                    : 'sr-only'
                }
              >
                {locales.length > 1
                  ? CATALOGS[language].language.name
                  : t.admin.organization.rules}
              </span>
              <textarea
                lang={language}
                rows={5}
                placeholder={t.admin.organization.rulesPlaceholder}
                value={rulesText[language] ?? ''}
                onChange={(event) =>
                  setRulesText({...rulesText, [language]: event.target.value})
                }
                onBlur={() => leave(`rules.${language}`)}
                aria-invalid={shown ? true : undefined}
                aria-describedby={shown ? problemId : undefined}
                className={`w-full rounded-xs border bg-theme-surface px-4 py-3 text-base leading-6 text-theme-ink placeholder:text-theme-faint ${
                  shown
                    ? 'border-theme-danger'
                    : 'border-theme-edge focus:border-theme-ink'
                }`}
              />
            </label>
            {shown ? <FieldProblem id={problemId} message={shown} /> : null}
          </div>
        );
      })}
      <Note>{t.admin.organization.rulesNote}</Note>
      <Status
        message={
          error ??
          (saved && !checked.changed ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={checked.changed}
        submitting={submitting}
      />
    </form>
  );
}
