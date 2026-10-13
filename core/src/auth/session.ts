// What the auth client's useSession reports, in the parts SessionGate reads,
// and whether it has answered once before: a check that follows a sign-in
// attempt is pending too.
type SessionStatus = {
  session: unknown;
  isPending: boolean;
  error: unknown;
  answered: boolean;
};

export type SessionView = 'signed-in' | 'waiting' | 'failed' | 'signed-out';

// A live session renders the app even while it is checked again, so a
// refetch never unmounts it. Without one, only the first check shows the
// blank screen: a later one keeps the sign-in screen, which is in the
// middle of its steps when a password has just been sent.
export function sessionView({
  session,
  isPending,
  error,
  answered,
}: SessionStatus): SessionView {
  if (session) {
    return 'signed-in';
  }

  if (isPending && !answered) {
    return 'waiting';
  }

  return error ? 'failed' : 'signed-out';
}
