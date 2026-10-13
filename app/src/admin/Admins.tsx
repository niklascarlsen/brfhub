import {checkAdmin, failureMessage} from '@booking/core/admin/drafts';
import {useProblems} from '@booking/core/admin/useProblems';
import type {AdminUser} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
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
  busy,
  last,
  onRemove,
  onReset,
}: {
  admin: AdminUser;
  busy: boolean;
  last: boolean;
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
    <View
      className={`gap-3 px-[18px] py-3.5 ${last ? '' : 'border-b border-theme-line'}`}
    >
      <View className='gap-0.5'>
        <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {admin.name}
          {admin.self ? (
            <Text className='font-sans text-theme-muted'>
              {` (${t.admin.admins.you})`}
            </Text>
          ) : null}
        </Text>
        <Text className='font-sans text-[13px] text-theme-muted'>
          {admin.email}
        </Text>
        <Text className='font-sans text-[13px] text-theme-muted'>
          {details.join(' · ')}
        </Text>
      </View>
      {admin.self ? null : (
        <View className='flex-row flex-wrap gap-2.5'>
          <Pressable
            onPress={onReset}
            disabled={busy}
            className={`${SECONDARY_BUTTON} h-10`}
          >
            <Text className={SECONDARY_LABEL}>
              {t.admin.admins.resetTwoFactor}
            </Text>
          </Pressable>
          <Pressable
            onPress={onRemove}
            disabled={busy}
            className={`${SECONDARY_BUTTON} h-10`}
          >
            <Text className={SECONDARY_LABEL}>{t.admin.admins.remove}</Text>
          </Pressable>
        </View>
      )}
    </View>
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
    <View className='gap-4'>
      <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
        {admins.map((admin, index) => (
          <AdminRow
            key={admin.id}
            admin={admin}
            busy={busy}
            last={index === admins.length - 1}
            onRemove={() => actions.admins.confirmRemove(admin)}
            onReset={() => actions.admins.confirmResetTwoFactor(admin)}
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
          <Ionicons name='add' size={18} color={theme.surface} />
          <Text className={PRIMARY_LABEL}>{t.admin.admins.add}</Text>
        </Pressable>
      )}
    </View>
  );
}
