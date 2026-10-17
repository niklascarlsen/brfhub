import {useChangePassword} from '@brfhub/core/auth/useChangePassword';
import {View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {Note, Status} from '@/admin/FormText';
import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

// A new password signs out every other device signed in to the account.
// Better Auth changes it, outside the admin's API.
export function ChangePassword() {
  const t = useMessages();
  const change = useChangePassword({auth: authClient, t});
  const {fields, problem, leave} = change;

  return (
    <View className='gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.currentPassword}
        value={fields.current}
        onChangeText={(value) => change.edit('current', value)}
        onBlur={() => leave('current')}
        problem={problem('current')}
        secureTextEntry
        autoComplete='current-password'
        textContentType='password'
      />
      <FloatingLabelInput
        label={t.admin.organization.newPassword}
        value={fields.next}
        onChangeText={(value) => change.edit('next', value)}
        onBlur={() => leave('next')}
        problem={problem('next')}
        secureTextEntry
        autoComplete='new-password'
        textContentType='newPassword'
      />
      <View className='gap-2'>
        <FloatingLabelInput
          label={t.admin.organization.repeatPassword}
          value={fields.repeat}
          onChangeText={(value) => change.edit('repeat', value)}
          onBlur={() => leave('repeat')}
          problem={problem('repeat')}
          secureTextEntry
          autoComplete='new-password'
          textContentType='newPassword'
        />
        <Note>{t.admin.organization.passwordNote}</Note>
      </View>
      <Status message={change.message} />
      <FormActions
        submitLabel={t.admin.organization.changePassword}
        dirty={change.changed}
        submitting={change.submitting}
        onSubmit={() => void change.submit()}
      />
    </View>
  );
}
