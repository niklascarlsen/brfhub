import type {Messages} from '../i18n/catalog';

export type DialogAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
  // What the button that closes without acting says, when the default
  // below does not fit the question.
  cancelLabel?: string;
};

export type DialogChoice = {
  label: string;
  onPress: () => void;
};

// How a client shows a message or asks before acting: an Alert in the app,
// a modal dialog on the web. choose lists one button per choice above a
// cancel, as many as there are.
export type Dialog = {
  alert: (title: string, message: string) => void;
  confirm: (title: string, message: string, action: DialogAction) => void;
  choose: (title: string, message: string, choices: DialogChoice[]) => void;
};

// What the button that closes a confirmation without acting says. Next to
// an action that removes or cancels something, such as "Cancel booking",
// "Cancel" would read as the action itself, so it says to keep it instead.
export function dismissLabel(action: DialogAction, t: Messages): string {
  return (
    action.cancelLabel ?? (action.destructive ? t.common.keep : t.common.cancel)
  );
}
