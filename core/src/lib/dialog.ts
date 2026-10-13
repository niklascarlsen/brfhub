export type DialogAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
  // What the button that closes without acting says, when not cancel.
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
