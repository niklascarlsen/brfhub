import {useChangePassword} from '@brfhub/core/auth/useChangePassword';
import {type SubmitEvent} from 'react';

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

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void change.submit();
  }

  return (
    <form noValidate onSubmit={submit} className='flex flex-col gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.currentPassword}
        type='password'
        autoComplete='current-password'
        required
        value={fields.current}
        onChange={(event) => change.edit('current', event.target.value)}
        onBlur={() => leave('current')}
        problem={problem('current')}
      />
      <FloatingLabelInput
        label={t.admin.organization.newPassword}
        type='password'
        autoComplete='new-password'
        required
        value={fields.next}
        onChange={(event) => change.edit('next', event.target.value)}
        onBlur={() => leave('next')}
        problem={problem('next')}
      />
      <div className='flex flex-col gap-2'>
        <FloatingLabelInput
          label={t.admin.organization.repeatPassword}
          type='password'
          autoComplete='new-password'
          required
          value={fields.repeat}
          onChange={(event) => change.edit('repeat', event.target.value)}
          onBlur={() => leave('repeat')}
          problem={problem('repeat')}
        />
        <Note>{t.admin.organization.passwordNote}</Note>
      </div>
      <Status message={change.message} />
      <FormActions
        submitLabel={t.admin.organization.changePassword}
        dirty={change.changed}
        submitting={change.submitting}
      />
    </form>
  );
}
