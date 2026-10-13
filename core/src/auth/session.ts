// What the auth client's useSession reports, in the parts SessionGate reads.
type SessionStatus = {
  session: unknown;
  isPending: boolean;
  error: unknown;
};

export type SessionView = 'signed-in' | 'waiting' | 'failed' | 'signed-out';

// A live session renders the app even while it is checked again, so a
// refetch never unmounts it. Only without one does a pending check or a
// failed one show instead of the sign-in screen.
export function sessionView({
  session,
  isPending,
  error,
}: SessionStatus): SessionView {
  if (session) {
    return 'signed-in';
  }

  if (isPending) {
    return 'waiting';
  }

  return error ? 'failed' : 'signed-out';
}
