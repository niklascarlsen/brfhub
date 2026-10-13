import {checkAdmin, failureMessage} from '@booking/core/admin/drafts';
import {useProblems} from '@booking/core/admin/useProblems';
import type {AdminUser} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import {useState, type SubmitEvent} from 'react';

import {FormActions} from '@/admin/FormActions';
import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {AddIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

const EMPTY = {name: '', email: ''};

function AdminForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (fields: typeof EMPTY) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useMessages();
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checked = checkAdmin(fields, t);
  const {problem, leave, ready} = useProblems(checked);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setFields((previous) => ({...previous, [key]: value}));

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
      // The server checks the email more closely than the field does.
      setError(failureMessage(caught, t, t.admin.admins.checkEmail));
      setSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      <FloatingLabelInput
        label={t.admin.admins.name}
        name='name'
        autoComplete='off'
        required
        value={fields.name}
        onChange={(event) => set('name')(event.target.value)}
        onBlur={() => leave('name')}
        problem={problem('name')}
      />
      <FloatingLabelInput
        label={t.common.email}
        type='email'
        name='email'
        autoComplete='off'
        required
        value={fields.email}
        onChange={(event) => set('email')(event.target.value)}
        onBlur={() => leave('email')}
        problem={problem('email')}
      />
      <p className='text-[13px] leading-5 text-theme-muted'>
        {t.admin.admins.note}
      </p>
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel={t.admin.add}
        dirty={checked.changed}
        submitting={submitting}
        onCancel={onCancel}
      />
    </form>
  );
}

function AdminRow({
  admin,
  busy,
  onRemove,
  onReset,
}: {
  admin: AdminUser;
  busy: boolean;
  onRemove: () => void;
  onReset: () => void;
}) {
  const t = useMessages();
  const details = [
    admin.apartment === null ? null : t.admin.admins.lives(admin.apartment),
    admin.twoFactorEnabled ? null : t.admin.admins.noTwoFactor,
    admin.lastSignInOn
      ? t.admin.admins.lastSignIn(formatLongDate(admin.lastSignInOn, t))
      : t.admin.admins.never,
  ].filter((detail) => detail !== null);

  return (
    <li className='flex flex-col gap-3 px-4.5 py-3.5'>
      <div className='flex flex-col gap-0.5'>
        <span className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {admin.name}
          {admin.self ? (
            <span className='font-normal text-theme-muted'>
              {` (${t.admin.admins.you})`}
            </span>
          ) : null}
        </span>
        <span className='text-[13px] text-theme-muted'>{admin.email}</span>
        <span className='text-[13px] text-theme-muted'>
          {details.join(' · ')}
        </span>
      </div>
      {admin.self ? null : (
        <div className='flex flex-wrap gap-2.5'>
          <button
            type='button'
            onClick={onReset}
            disabled={busy}
            className={`${SECONDARY_BUTTON} h-10`}
          >
            {t.admin.admins.resetTwoFactor}
          </button>
          <button
            type='button'
            onClick={onRemove}
            disabled={busy}
            className={`${SECONDARY_BUTTON} h-10`}
          >
            {t.admin.admins.remove}
          </button>
        </div>
      )}
    </li>
  );
}

// The organization's admins: who they are, and adding or removing one.
export function Admins() {
  const t = useMessages();
  const {data: admins, error, reload} = useFocusLoad(adminLoad.admins);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const actions = useAdminActions(reload, setBusy);

  if (error && !admins) {
    return (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  }

  if (!admins) {
    return null;
  }

  return (
    <div className='flex flex-col gap-4'>
      <ul className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
        {admins.map((admin) => (
          <AdminRow
            key={admin.id}
            admin={admin}
            busy={busy}
            onRemove={() => actions.admins.confirmRemove(admin)}
            onReset={() => actions.admins.confirmResetTwoFactor(admin)}
          />
        ))}
      </ul>
      {adding ? (
        <AdminForm
          onSubmit={async (fields) => {
            await actions.admins.add(fields);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type='button'
          onClick={() => setAdding(true)}
          className={`${PRIMARY_BUTTON} self-start`}
        >
          <AddIcon size={18} />
          {t.admin.admins.add}
        </button>
      )}
    </div>
  );
}
