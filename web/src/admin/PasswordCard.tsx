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
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(password).then(() => setCopied(true));
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className={`${CARD} flex flex-col gap-3`}>
        <span className='text-sm font-semibold text-theme-muted'>
          Lösenord för lägenhet {apartment.label}
        </span>
        <span className='font-mono text-[26px] font-semibold tracking-wide text-theme-ink select-all'>
          {password}
        </span>
        <p className='text-[13px] leading-5 text-theme-muted'>
          Visas bara nu. Ge det till de boende tillsammans med e-postadressen{' '}
          <span className='text-theme-ink'>{apartment.email}</span>. De loggar
          in med båda.
        </p>
      </div>
      <div className='flex flex-wrap gap-2.5'>
        <button type='button' onClick={copy} className={SECONDARY_BUTTON}>
          {copied ? 'Kopierat' : 'Kopiera lösenordet'}
        </button>
        <button type='button' onClick={onDone} className={PRIMARY_BUTTON}>
          Klar
        </button>
      </div>
    </div>
  );
}
