import {useState} from 'react';

import type {Apartment} from '@/api/client';
import {CARD, PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';

type PasswordCardProps = {
  apartment: Apartment;
  password: string;
  onDone: () => void;
};

// The only time the password is shown: the server keeps nothing but its
// hash, so it has to be written down or passed on now.
export function PasswordCard({apartment, password, onDone}: PasswordCardProps) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  // The same text the app shares. The clipboard is missing outside secure
  // contexts, such as plain http over the LAN.
  const copyLogin = () => {
    const login = `Inloggning för lägenhet ${apartment.label}\nE-post: ${apartment.email}\nLösenord: ${password}`;

    Promise.resolve()
      .then(() => navigator.clipboard.writeText(login))
      .then(() => setCopy('copied'))
      .catch(() => setCopy('failed'));
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className={`${CARD} flex flex-col gap-3`}>
        <span className='text-sm font-semibold text-theme-muted'>
          Lösenord för lägenhet {apartment.label}
        </span>
        <span className='text-[26px] font-semibold tracking-wide text-theme-ink select-all'>
          {password}
        </span>
        <p className='text-[13px] leading-5 text-theme-muted'>
          Visas bara nu. Ge det till de boende tillsammans med e-postadressen{' '}
          <span className='text-theme-ink'>{apartment.email}</span>. De loggar
          in med båda.
        </p>
        {copy === 'failed' ? (
          <p role='alert' className='text-[13px] leading-5 text-theme-ink'>
            Det gick inte att kopiera här. Markera lösenordet och kopiera det
            själv.
          </p>
        ) : null}
      </div>
      <div className='flex flex-wrap gap-2.5'>
        <button type='button' onClick={copyLogin} className={SECONDARY_BUTTON}>
          {copy === 'copied' ? 'Inloggningen kopierad' : 'Kopiera inloggningen'}
        </button>
        <button type='button' onClick={onDone} className={PRIMARY_BUTTON}>
          Klar
        </button>
      </div>
    </div>
  );
}
