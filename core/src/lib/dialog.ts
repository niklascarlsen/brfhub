import type {Messages} from '../i18n/catalog';

export type DialogAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
  // What the button that closes without acting says, when the default
  // below does not fit the question.
  cancelLabel?: string;
  // Runs when the dialog closes without the action.
  onDismiss?: () => void;
};

// A time shown on a card of its own under the message, rather than inside
// a sentence where two of them run together.
export type DialogTime = {
  // What the time is to the question, such as the booking given up.
  caption?: string;
  // A time given up or one gained, told apart by colour as well as by the
  // caption.
  tone?: 'old' | 'new';
  resource: string;
  when: string;
};

export type DialogChoice = {
  // What a screen reader says for the choice, and what it shows without a
  // time.
  label: string;
  time?: DialogTime;
  onPress: () => void;
};

// How a client shows a message or asks before acting, in a dialog of its
// own in both. confirm and choose can show times under the message; choose
// lists one button per choice above a cancel, as many as there are.
export type Dialog = {
  alert: (title: string, message: string) => void;
  confirm: (
    title: string,
    message: string,
    action: DialogAction,
    times?: DialogTime[],
  ) => void;
  choose: (
    title: string,
    message: string,
    choices: DialogChoice[],
    options?: {times?: DialogTime[]; choicesLabel?: string},
  ) => void;
};

// The buttons a dialog offers, in order, for a screen reader to name as
// the dialog opens.
export function optionLabels(
  {action, choices}: {action?: DialogAction; choices?: DialogChoice[]},
  t: Messages,
): string[] {
  if (choices) {
    return [...choices.map((choice) => choice.label), t.common.cancel];
  }

  return [
    ...(action ? [dismissLabel(action, t)] : []),
    action?.label ?? t.common.ok,
  ];
}

// What the button that closes a confirmation without acting says. Next to
// an action that removes or cancels something, such as "Cancel booking",
// "Cancel" would read as the action itself, so it says to keep it instead.
export function dismissLabel(action: DialogAction, t: Messages): string {
  return (
    action.cancelLabel ?? (action.destructive ? t.common.keep : t.common.cancel)
  );
}
