import type {AdminAccount} from '@booking/core/auth/account';
import {
  enableFailure,
  qrCodeOf,
  secretOf,
  verifyFailure,
  type SetupStep,
} from '@booking/core/auth/twoFactor';
import {useState, type SubmitEvent} from 'react';

import {CARD, PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {authClient} from '@/auth/client';
import {signOut} from '@/auth/signOut';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

// The QR code the authenticator app scans.
function QrCode({text}: {text: string}) {
  const {size, cells} = qrCodeOf(text);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role='img'
      aria-label={text}
      shapeRendering='crispEdges'
      className='h-55 w-55 self-center rounded-xl bg-white p-3'
    >
      {cells.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              className='fill-theme-ink'
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

type TwoFactorSetupProps = {
  account: AdminAccount;
  // The server is asked again, and shows the admin's app.
  onDone: () => void;
};

// An admin signs in with a password and a code from an authenticator app,
// and may do nothing else until one is set up: the password first, then
// the app scans the code and answers with its first code, then the backup
// codes are shown once.
export function TwoFactorSetup({account, onDone}: TwoFactorSetupProps) {
  const t = useMessages();
  const [step, setStep] = useState<SetupStep>({kind: 'password'});
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function run(action: () => Promise<void>) {
    setSubmitting(true);
    setError(null);
    await action();
    setSubmitting(false);
  }

  const begin = () =>
    run(async () => {
      // Better Auth throws rather than answers when the network fails.
      const result = await authClient.twoFactor
        .enable({password})
        .catch(() => null);

      // The plugin can also mail codes, which this server never asks for.
      if (result === null || result.error || result.data.method !== 'totp') {
        setError(enableFailure(result?.error ?? null, t));
        return;
      }

      setPassword('');
      setStep({
        kind: 'scan',
        totpUri: result.data.totpURI,
        backupCodes: result.data.backupCodes,
      });
    });

  const verify = (backupCodes: string[]) =>
    run(async () => {
      const result = await authClient.twoFactor
        .verifyTotp({code: code.trim()})
        .catch(() => null);

      if (result === null || result.error) {
        setError(verifyFailure(result?.error ?? null, t));
        return;
      }

      setStep({kind: 'backup', backupCodes});
    });

  const copy = (backupCodes: string[]) => {
    navigator.clipboard
      .writeText(backupCodes.join('\n'))
      .then(() => setNotice(t.twoFactor.copied))
      .catch(() => setNotice(null));
  };

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (step.kind === 'password') {
      void begin();
    } else if (step.kind === 'scan') {
      void verify(step.backupCodes);
    } else {
      onDone();
    }
  }

  const problem = error ? (
    <p role='alert' className='text-sm text-theme-ink'>
      {error}
    </p>
  ) : null;

  let body;
  if (step.kind === 'password') {
    body = (
      <>
        <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.twoFactor.title}
        </h1>
        <p className='mb-6 text-sm leading-5 text-theme-muted'>
          {t.twoFactor.intro}
        </p>
        <div className='flex flex-col gap-4'>
          <FloatingLabelInput
            label={t.twoFactor.password}
            type='password'
            name='password'
            autoComplete='current-password'
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {problem}
          <div className='flex flex-wrap gap-2.5'>
            <button
              type='submit'
              disabled={password.length === 0 || submitting}
              className={PRIMARY_BUTTON}
            >
              {t.twoFactor.begin}
            </button>
            <button
              type='button'
              onClick={() => void signOut()}
              className={SECONDARY_BUTTON}
            >
              {t.account.signOut}
            </button>
          </div>
        </div>
      </>
    );
  } else if (step.kind === 'scan') {
    body = (
      <>
        <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.twoFactor.scanTitle}
        </h1>
        <p className='mb-6 text-sm leading-5 text-theme-muted'>
          {t.twoFactor.scanIntro}
        </p>
        <div className='flex flex-col gap-4'>
          <QrCode text={step.totpUri} />
          <div className={`${CARD} flex flex-col gap-1`}>
            <span className='text-sm font-semibold text-theme-muted'>
              {t.twoFactor.manualKey}
            </span>
            <span className='text-[17px] font-semibold tracking-wide text-theme-ink select-all'>
              {secretOf(step.totpUri)}
            </span>
          </div>
          <FloatingLabelInput
            label={t.twoFactor.firstCode}
            type='text'
            name='code'
            autoComplete='one-time-code'
            inputMode='numeric'
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          {problem}
          <button
            type='submit'
            disabled={code.trim().length === 0 || submitting}
            className={`${PRIMARY_BUTTON} self-start`}
          >
            {t.twoFactor.verify}
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.twoFactor.backupTitle}
        </h1>
        <p className='mb-6 text-sm leading-5 text-theme-muted'>
          {t.twoFactor.backupIntro}
        </p>
        <div className='flex flex-col gap-4'>
          <ul className={`${CARD} flex flex-col gap-1.5`}>
            {step.backupCodes.map((backupCode) => (
              <li
                key={backupCode}
                className='text-[17px] font-semibold tracking-wide text-theme-ink tabular-nums select-all'
              >
                {backupCode}
              </li>
            ))}
          </ul>
          {notice ? (
            <p role='status' className='text-sm text-theme-muted'>
              {notice}
            </p>
          ) : null}
          <div className='flex flex-wrap gap-2.5'>
            <button
              type='button'
              onClick={() => copy(step.backupCodes)}
              className={SECONDARY_BUTTON}
            >
              {t.twoFactor.copyCodes}
            </button>
            <button type='submit' className={PRIMARY_BUTTON}>
              {t.twoFactor.done}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className='flex min-h-svh flex-col bg-theme-bg pt-[env(safe-area-inset-top)]'>
      <main className='flex grow flex-col px-5 pt-2 pb-8 lg:items-center'>
        <form
          key={step.kind}
          onSubmit={onSubmit}
          className='flex w-full flex-col lg:w-120 lg:p-2'
        >
          <p className='mt-1 mb-6 text-[13px] text-theme-muted'>
            {account.organizationName}
          </p>
          {body}
        </form>
      </main>
    </div>
  );
}
