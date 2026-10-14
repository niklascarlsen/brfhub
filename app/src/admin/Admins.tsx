import {checkAdmin, failureMessage} from '@booking/core/admin/drafts';
import {useProblems} from '@booking/core/admin/useProblems';
import type {AdminUser} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import {Icon} from '@/components/Icon';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {ActionRow, Badge, DetailRow} from '@/admin/Rows';
import {
  CARD,
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL,
} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

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

  async function submit() {
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
    <View className='gap-3'>
      <FloatingLabelInput
        label={t.admin.admins.name}
        value={fields.name}
        onChangeText={set('name')}
        onBlur={() => leave('name')}
        problem={problem('name')}
        autoCapitalize='words'
        autoCorrect={false}
        returnKeyType='next'
      />
      <FloatingLabelInput
        label={t.common.email}
        value={fields.email}
        onChangeText={set('email')}
        onBlur={() => leave('email')}
        problem={problem('email')}
        autoCapitalize='none'
        autoComplete='off'
        autoCorrect={false}
        keyboardType='email-address'
        returnKeyType='done'
      />
      <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
        {t.admin.admins.note}
      </Text>
      {error ? (
        <Text
          accessibilityRole='alert'
          className='font-sans text-sm text-theme-ink'
        >
          {error}
        </Text>
      ) : null}
      <FormActions
        submitLabel={t.admin.add}
        dirty={checked.changed}
        submitting={submitting}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      />
    </View>
  );
}

function AdminRow({
  admin,
  last,
  onOpen,
}: {
  admin: AdminUser;
  last: boolean;
  onOpen: () => void;
}) {
  const t = useMessages();
  const details = [
    admin.apartment === null ? null : t.admin.admins.lives(admin.apartment),
    admin.lastSignInOn
      ? t.admin.admins.lastSignIn(formatLongDate(admin.lastSignInOn, t))
      : t.admin.admins.never,
  ].filter((detail) => detail !== null);
  const row = `flex-row items-center gap-3 px-[18px] py-3.5 ${
    last ? '' : 'border-b border-theme-line'
  }`;

  const content = (
    <>
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {admin.name}
          {admin.self ? (
            <Text className='font-sans text-theme-muted'>
              {` (${t.admin.admins.you})`}
            </Text>
          ) : null}
        </Text>
        <Text
          numberOfLines={1}
          className='font-sans text-[13px] text-theme-muted'
        >
          {admin.email}
        </Text>
        <Text className='font-sans text-[13px] text-theme-muted'>
          {details.join(' · ')}
        </Text>
        {admin.twoFactorEnabled ? null : (
          <View className='mt-1 flex-row'>
            <Badge>{t.admin.admins.twoFactorMissing}</Badge>
          </View>
        )}
      </View>
    </>
  );

  // There is nothing an admin can do to their own account here.
  if (admin.self) {
    return <View className={row}>{content}</View>;
  }

  return (
    <Pressable onPress={onOpen} className={`${row} active:bg-theme-sunk`}>
      {content}
      <Icon name='chevron-forward' size={16} color={theme.faint} />
    </Pressable>
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
    <View className='gap-4'>
      <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
        {admins.map((admin, index) => (
          <AdminRow
            key={admin.id}
            admin={admin}
            last={index === admins.length - 1}
            onOpen={() => onOpen(admin)}
          />
        ))}
      </View>
      {adding ? (
        <AdminForm
          onSubmit={async (fields) => {
            await actions.admins.add(fields);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          className={`${PRIMARY_BUTTON} self-start`}
        >
          <Icon name='add' size={18} color={theme.surface} />
          <Text className={PRIMARY_LABEL}>{t.admin.admins.add}</Text>
        </Pressable>
      )}
    </View>
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
    <View className='gap-[26px]'>
      <View>
        <Text className={SECTION_LABEL}>{t.admin.details}</Text>
        <View className={`${CARD} py-1.5`}>
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
            last
          />
        </View>
      </View>
      {/* Nothing to reset before an authenticator is set up. */}
      {admin.twoFactorEnabled ? (
        <View>
          <Text className={SECTION_LABEL}>{t.admin.actions}</Text>
          <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
            <ActionRow
              label={t.admin.admins.resetTwoFactor}
              description={t.admin.admins.resetHint}
              disabled={busy}
              onPress={() => actions.admins.confirmResetTwoFactor(admin)}
              last
            />
          </View>
        </View>
      ) : null}
      <Pressable
        onPress={() => actions.admins.confirmRemove(admin, onRemoved)}
        disabled={busy}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        <Text className={SECONDARY_LABEL}>{t.admin.admins.removeAdmin}</Text>
      </Pressable>
    </View>
  );
}
