import type {ReactNode} from 'react';
import {Pressable, Text, View} from 'react-native';

import {
  INACTIVE_BUTTON,
  INACTIVE_LABEL,
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import {useConfirmLeave, useUnsavedChanges} from '@/admin/unsaved';
import {useMessages} from '@/i18n/LocaleProvider';

type FormActionsProps = {
  submitLabel: string;
  // Changed from what was saved. A form that is not cannot be saved, and
  // leaving one that is asks first. A save of a form with problems shows
  // them instead of sending.
  dirty: boolean;
  // Can be sent though nothing has changed, such as a closing, which is
  // new each time.
  ready?: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  // Further buttons, such as one that removes what the form edits.
  children?: ReactNode;
};

// The buttons under an admin form. Saving lights up once something has
// changed, and a line above it says so.
export function FormActions({
  submitLabel,
  dirty,
  ready = false,
  submitting,
  onSubmit,
  onCancel,
  children,
}: FormActionsProps) {
  const t = useMessages();
  const confirmLeave = useConfirmLeave();

  useUnsavedChanges(dirty);

  return (
    <View className='mt-2 gap-3'>
      {dirty && !submitting ? (
        <View className='flex-row items-center gap-2'>
          <View className='h-1.5 w-1.5 rounded-full bg-theme-accent' />
          <Text className='font-sans text-[13px] text-theme-accent'>
            {t.admin.unsaved.hint}
          </Text>
        </View>
      ) : null}
      <View className='flex-row flex-wrap gap-2.5'>
        <Pressable
          onPress={onSubmit}
          disabled={!(dirty || ready) || submitting}
          accessibilityState={{disabled: !(dirty || ready) || submitting}}
          className={dirty || ready ? PRIMARY_BUTTON : INACTIVE_BUTTON}
        >
          <Text className={dirty || ready ? PRIMARY_LABEL : INACTIVE_LABEL}>
            {submitLabel}
          </Text>
        </Pressable>
        {onCancel ? (
          <Pressable
            onPress={() => confirmLeave(onCancel)}
            className={SECONDARY_BUTTON}
          >
            <Text className={SECONDARY_LABEL}>{t.common.cancel}</Text>
          </Pressable>
        ) : null}
        {children}
      </View>
    </View>
  );
}
