import {checkAdmin, failureMessage} from '@booking/core/admin/drafts';
import {useProblems} from '@booking/core/admin/useProblems';
import type {AdminUser} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import {useState, type SubmitEvent} from 'react';

import {FormActions} from '@/admin/FormActions';
import {ActionRow, Badge, DetailRow} from '@/admin/Rows';
import {
  CARD,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SECTION_LABEL,
} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {useAdminActions} from '@/hooks/useAdminActions';
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

function AdminRow({admin, onOpen}: {admin: AdminUser; onOpen: () => void}) {
  const t = useMessages();
  const details = [
    admin.apartment === null ? null : t.admin.admins.lives(admin.apartment),
    admin.lastSignInOn
      ? t.admin.admins.lastSignIn(formatLongDate(admin.lastSignInOn, t))
      : t.admin.admins.never,
  ].filter((detail) => detail !== null);

  const content = (
    <>
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {admin.name}
          {admin.self ? (
            <span className='font-normal text-theme-muted'>
              {` (${t.admin.admins.you})`}
            </span>
          ) : null}
        </span>
        <span className='truncate text-[13px] text-theme-muted'>
          {admin.email}
        </span>
        <span className='text-[13px] text-theme-muted'>
          {details.join(' · ')}
        </span>
        {admin.twoFactorEnabled ? null : (
          <span className='mt-1 flex'>
            <Badge>{t.admin.admins.twoFactorMissing}</Badge>
          </span>
        )}
      </span>
    </>
  );

  // There is nothing an admin can do to their own account here.
  if (admin.self) {
    return <li className='flex items-center gap-3 px-4.5 py-3.5'>{content}</li>;
  }

  return (
    <li>
      <button
        type='button'
        onClick={onOpen}
        className='flex w-full items-center gap-3 px-4.5 py-3.5 text-left transition-colors hover:bg-theme-sunk'
      >
        {content}
        <ChevronForwardIcon size={16} className='shrink-0 text-theme-faint' />
      </button>
    </li>
  );
}

type AdminsProps = {
  admins: AdminUser[];
  onOpen: (admin: AdminUser) => void;
  onChanged: () => void;
};

// The organization's admins, and adding one. Each of the others opens on
// a page of its own.
export function Admins({admins, onOpen, onChanged}: AdminsProps) {
  const t = useMessages();
  const [adding, setAdding] = useState(false);
  const actions = useAdminActions(onChanged);

  return (
    <div className='flex flex-col gap-4'>
      <ul className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
        {admins.map((admin) => (
          <AdminRow key={admin.id} admin={admin} onOpen={() => onOpen(admin)} />
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

type AdminDetailProps = {
  admin: AdminUser;
  onChanged: () => void;
  onRemoved: () => void;
};

// Another admin: who they are, and what can be done for them.
export function AdminDetail({admin, onChanged, onRemoved}: AdminDetailProps) {
  const t = useMessages();
  // A second tap while a request runs would reset twice or remove twice.
  const [busy, setBusy] = useState(false);
  const actions = useAdminActions(onChanged, setBusy);

  return (
    <div className='flex flex-col gap-6.5'>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.details}</h2>
        <div
          className={`${CARD} flex flex-col divide-y divide-theme-line py-1.5`}
        >
          <DetailRow label={t.common.email} value={admin.email} />
          {admin.apartment === null ? null : (
            <DetailRow
              label={t.admin.admins.apartment}
              value={admin.apartment}
            />
          )}
          <DetailRow
            label={t.admin.admins.twoFactor}
            value={
              admin.twoFactorEnabled
                ? t.admin.admins.twoFactorOn
                : t.admin.admins.twoFactorOff
            }
          />
          <DetailRow
            label={t.admin.apartment.lastSignIn}
            value={
              admin.lastSignInOn
                ? formatLongDate(admin.lastSignInOn, t)
                : t.admin.apartment.never
            }
          />
        </div>
      </section>
      {/* Nothing to reset before an authenticator is set up. */}
      {admin.twoFactorEnabled ? (
        <section>
          <h2 className={SECTION_LABEL}>{t.admin.actions}</h2>
          <div className='flex flex-col overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
            <ActionRow
              label={t.admin.admins.resetTwoFactor}
              description={t.admin.admins.resetHint}
              disabled={busy}
              onPress={() => actions.admins.confirmResetTwoFactor(admin)}
            />
          </div>
        </section>
      ) : null}
      <button
        type='button'
        onClick={() => actions.admins.confirmRemove(admin, onRemoved)}
        disabled={busy}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        {t.admin.admins.removeAdmin}
      </button>
    </div>
  );
}
