export type DialogAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
  // What the button that closes without acting says, when not cancel.
  cancelLabel?: string;
};

// How a client shows a message or asks before acting: an Alert in the app,
// a modal dialog on the web.
export type Dialog = {
  alert: (title: string, message: string) => void;
  confirm: (title: string, message: string, action: DialogAction) => void;
};
