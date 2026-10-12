import type {Apartment} from '@booking/core/api/types';
import {useState} from 'react';

import {useMessages} from '@/i18n/LocaleProvider';
import {CARD, PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';

type PasswordCardProps = {
  apartment: Apartment;
  password: string;
  onDone: () => void;
};

// The only time the password is shown: the server keeps nothing but its
// hash, so it has to be written down or passed on now.
export function PasswordCard({apartment, password, onDone}: PasswordCardProps) {
  const t = useMessages();
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  // The same text the app shares. The clipboard is missing outside secure
  // contexts, such as plain http over the LAN.
  const copyLogin = () => {
    const login = t.admin.password.login(
      apartment.label,
      apartment.email,
      password,
    );

    Promise.resolve()
      .then(() => navigator.clipboard.writeText(login))
      .then(() => setCopy('copied'))
      .catch(() => setCopy('failed'));
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className={`${CARD} flex flex-col gap-3`}>
        <span className='text-sm font-semibold text-theme-muted'>
          {t.admin.password.title(apartment.label)}
        </span>
        <span className='text-[26px] font-semibold tracking-wide text-theme-ink select-all'>
          {password}
        </span>
        <p className='text-[13px] leading-5 text-theme-muted'>
          {t.admin.password.beforeEmail}{' '}
          <span className='text-theme-ink'>{apartment.email}</span>
          {t.admin.password.afterEmail}
        </p>
        {copy === 'failed' ? (
          <p role='alert' className='text-[13px] leading-5 text-theme-ink'>
            {t.admin.password.copyFailed}
          </p>
        ) : null}
      </div>
      <div className='flex flex-wrap gap-2.5'>
        <button type='button' onClick={copyLogin} className={SECONDARY_BUTTON}>
          {copy === 'copied' ? t.admin.password.copied : t.admin.password.copy}
        </button>
        <button type='button' onClick={onDone} className={PRIMARY_BUTTON}>
          {t.admin.password.done}
        </button>
      </div>
    </div>
  );
}
