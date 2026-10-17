import {useAdminAccount} from '@brfhub/core/admin/account';
import {
  checkResource,
  failureMessage,
  tagsText,
  type ResourceFields,
} from '@brfhub/core/admin/drafts';
import {fieldLabel, type Draft} from '@brfhub/core/admin/localized';
import {useProblems} from '@brfhub/core/admin/useProblems';
import type {AdminKind} from '@brfhub/core/api/types';
import {localize} from '@brfhub/core/i18n/catalog';
import {useState, type SubmitEvent} from 'react';

import {FormActions} from '@/admin/FormActions';
import {SlotsEditor} from '@/admin/SlotsEditor';
import {SECTION_LABEL} from '@/admin/styles';
import {FieldProblem} from '@/components/FieldProblem';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

type ResourceFormProps = {
  kinds: AdminKind[];
  initial: ResourceFields;
  // A new resource sets its first times here; later ones go through the
  // schedule, which has its own rules.
  withSlots: boolean;
  submitLabel: string;
  onSubmit: (fields: ResourceFields) => Promise<void>;
  onCancel: () => void;
};

export function ResourceForm({
  kinds,
  initial,
  withSlots,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps) {
  const t = useMessages();
  const {locale} = useLocale();
  const {locales} = useAdminAccount();
  const [name, setName] = useState<Draft>(initial.name);
  const [kindId, setKindId] = useState(initial.kindId);
  const [tags, setTags] = useState<Draft>(() => tagsText(initial.tags));
  const [slots, setSlots] = useState(initial.slots);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checked = checkResource(
    {name, kindId, tags, slots},
    initial,
    {locales, withSlots},
    t,
  );
  const {problem, leave, ready} = useProblems(checked);
  const slotsProblem = problem('slots');

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(checked.value);
    } catch (caught) {
      setError(failureMessage(caught, t));
      setSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          lang={language}
          label={fieldLabel(t.admin.resourceForm.name, language, locales, t)}
          required
          value={name[language] ?? ''}
          onChange={(event) =>
            setName({...name, [language]: event.target.value})
          }
          onBlur={() => leave(`name.${language}`)}
          problem={problem(`name.${language}`)}
        />
      ))}
      <fieldset className='flex flex-col gap-2'>
        <legend className='mb-2 text-[13px] font-medium text-theme-muted'>
          {t.admin.resource.kind}
        </legend>
        <div className='flex flex-wrap gap-2'>
          {kinds.map((kind) => {
            const selected = kind.id === kindId;

            return (
              <button
                key={kind.id}
                type='button'
                aria-pressed={selected}
                onClick={() => setKindId(kind.id)}
                className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-theme-ink bg-theme-ink text-theme-surface'
                    : 'border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
                }`}
              >
                {localize(kind.name, locale)}
              </button>
            );
          })}
        </div>
      </fieldset>
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          lang={language}
          label={fieldLabel(t.admin.resourceForm.tags, language, locales, t)}
          value={tags[language] ?? ''}
          onChange={(event) =>
            setTags({...tags, [language]: event.target.value})
          }
          onBlur={() => leave(`tags.${language}`)}
          problem={problem(`tags.${language}`)}
        />
      ))}
      {withSlots ? (
        <section className='mt-3'>
          <h2 className={SECTION_LABEL}>{t.admin.resourceForm.slots}</h2>
          <SlotsEditor slots={slots} onChange={setSlots} />
          {slotsProblem ? <FieldProblem message={slotsProblem} /> : null}
        </section>
      ) : null}
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel={submitLabel}
        dirty={checked.changed}
        submitting={submitting}
        onCancel={onCancel}
      />
    </form>
  );
}
