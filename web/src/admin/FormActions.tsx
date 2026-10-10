import type {ReactNode} from 'react';

import {
  INACTIVE_BUTTON,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from '@/admin/styles';
import {useConfirmLeave, useUnsavedChanges} from '@/admin/unsaved';
import {useMessages} from '@/i18n/LocaleProvider';

type FormActionsProps = {
  submitLabel: string;
  // Changed from what was saved. A form that is not cannot be saved, and
  // leaving one that is asks first.
  dirty: boolean;
  // Filled in well enough to send.
  valid: boolean;
  submitting: boolean;
  onCancel?: () => void;
  // Further buttons, such as one that removes what the form edits.
  children?: ReactNode;
};

// The buttons under an admin form, which submits through its own
// onSubmit. Saving lights up once something has changed, and a line above
// it says so.
export function FormActions({
  submitLabel,
  dirty,
  valid,
  submitting,
  onCancel,
  children,
}: FormActionsProps) {
  const t = useMessages();
  const confirmLeave = useConfirmLeave();
  const ready = dirty && valid;

  useUnsavedChanges(dirty);

  return (
    <div className='mt-2 flex flex-col gap-3'>
      {dirty && !submitting ? (
        <p className='flex items-center gap-2 text-[13px] text-theme-accent'>
          <span className='h-1.5 w-1.5 rounded-full bg-theme-accent' />
          {t.admin.unsaved.hint}
        </p>
      ) : null}
      <div className='flex flex-wrap gap-2.5'>
        <button
          type='submit'
          disabled={!ready || submitting}
          className={ready ? PRIMARY_BUTTON : INACTIVE_BUTTON}
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type='button'
            onClick={() => confirmLeave(onCancel)}
            className={SECONDARY_BUTTON}
          >
            {t.common.cancel}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}
