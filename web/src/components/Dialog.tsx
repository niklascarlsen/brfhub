import type {Dialog, DialogAction} from '@booking/core/lib/dialog';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {useMessages} from '@/i18n/LocaleProvider';

type DialogRequest = {
  title: string;
  message: string;
  action?: DialogAction;
};

const DialogContext = createContext<Dialog | null>(null);

const BUTTON =
  'h-11 flex-1 rounded-full text-sm font-semibold tracking-tight active:opacity-70';

export function useDialog(): Dialog {
  const dialog = useContext(DialogContext);

  if (dialog === null) {
    throw new Error('useDialog must be used inside DialogProvider');
  }

  return dialog;
}

export function DialogProvider({children}: {children: ReactNode}) {
  const t = useMessages();
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const messageId = useId();

  const api = useMemo<Dialog>(
    () => ({
      alert: (title, message) => setRequest({title, message}),
      confirm: (title, message, action) => setRequest({title, message, action}),
    }),
    [],
  );

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || request === null || dialog.open) {
      return;
    }

    dialog.showModal();
  }, [request]);

  const close = () => {
    setRequest(null);
    dialogRef.current?.close();
  };

  // The action has to run inside the click, or Safari drops the user gesture.
  const press = () => {
    const action = request?.action;

    close();
    action?.onPress();
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      <dialog
        ref={dialogRef}
        onCancel={close}
        onMouseDown={(event) => {
          pressedBackdrop.current = event.target === dialogRef.current;
        }}
        onClick={(event) => {
          // Both mousedown and click must land on the backdrop.
          if (pressedBackdrop.current && event.target === dialogRef.current) {
            close();
          }
        }}
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className='m-auto w-[calc(100%-40px)] max-w-85 rounded-2xl border border-theme-line bg-theme-surface backdrop:bg-theme-ink/30'
      >
        {request ? (
          <div className='p-5'>
            <p
              id={titleId}
              className='text-[17px] font-semibold tracking-tight text-theme-ink'
            >
              {request.title}
            </p>
            <p
              id={messageId}
              className='mt-1.5 text-sm leading-5 text-theme-muted'
            >
              {request.message}
            </p>
            <div className='mt-5 flex gap-2.5'>
              {request.action ? (
                <button
                  type='button'
                  onClick={close}
                  className={`${BUTTON} border border-theme-edge bg-theme-surface text-theme-ink transition-colors hover:bg-theme-sunk`}
                >
                  {request.action.cancelLabel ?? t.common.cancel}
                </button>
              ) : null}
              <button
                type='button'
                onClick={press}
                className={`${BUTTON} bg-theme-ink text-theme-surface transition-opacity hover:opacity-90`}
              >
                {request.action?.label ?? t.common.ok}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </DialogContext.Provider>
  );
}
