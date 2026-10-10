import {useState, type SubmitEvent} from 'react';

import {slotsProblem} from '@/admin/schedule';
import {SlotsEditor} from '@/admin/SlotsEditor';
import {PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import type {AdminKind, SlotInput} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

export type ResourceFields = {
  name: string;
  kindId: string;
  tags: string[];
  slots: SlotInput[];
};

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

function tagsOf(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function ResourceForm({
  kinds,
  initial,
  withSlots,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps) {
  const t = useMessages();
  const [name, setName] = useState(initial.name);
  const [kindId, setKindId] = useState(initial.kindId);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [slots, setSlots] = useState(initial.slots);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = withSlots ? slotsProblem(slots, t) : null;

    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({name: name.trim(), kindId, tags: tagsOf(tags), slots});
    } catch (caught) {
      setError(errorMessage(codeOf(caught), t));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      <FloatingLabelInput
        label={t.admin.resourceForm.name}
        required
        maxLength={40}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
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
                {kind.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <FloatingLabelInput
        label={t.admin.resourceForm.tags}
        value={tags}
        onChange={(event) => setTags(event.target.value)}
      />
      {withSlots ? (
        <section className='mt-3'>
          <h2 className={SECTION_LABEL}>{t.admin.resourceForm.slots}</h2>
          <SlotsEditor slots={slots} onChange={setSlots} />
        </section>
      ) : null}
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <div className='mt-2 flex flex-wrap gap-2.5'>
        <button
          type='submit'
          disabled={submitting || kindId === ''}
          className={PRIMARY_BUTTON}
        >
          {submitLabel}
        </button>
        <button type='button' onClick={onCancel} className={SECONDARY_BUTTON}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
