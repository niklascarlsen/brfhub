import {errorMessage} from '@booking/core/api/errors';
import {sessionView} from '@booking/core/auth/session';
import {useState, type ReactNode} from 'react';

import {authClient} from '@/auth/client';
import {Blank} from '@/components/Blank';
import {Notice} from '@/components/Notice';
import {useMessages} from '@/i18n/LocaleProvider';
import {LoginScreen} from '@/screens/LoginScreen';

// Everything below only renders with a live session, so a sign-out or an
// expired session unmounts the app state along with it.
export function SessionGate({children}: {children: ReactNode}) {
  const {data: session, isPending, error, refetch} = authClient.useSession();
  const t = useMessages();
  // Whether the session has been checked once, so a later check does not
  // unmount the sign-in screen between its steps. Set during the render
  // that sees the first answer, as React allows for a component's own state.
  const [answered, setAnswered] = useState(false);

  if (!isPending && !answered) {
    setAnswered(true);
  }

  switch (sessionView({session, isPending, error, answered})) {
    case 'signed-in':
      return children;
    case 'waiting':
      return <Blank />;
    case 'failed':
      return (
        <Blank>
          <Notice
            message={errorMessage('NETWORK', t)}
            actionLabel={t.common.retry}
            onAction={() => void refetch()}
          />
        </Blank>
      );
    case 'signed-out':
      return <LoginScreen />;
  }
}
