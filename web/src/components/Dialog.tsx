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

type DialogAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

type DialogRequest = {
  title: string;
  message: string;
  action?: DialogAction;
};

type DialogApi = {
  alert: (title: string, message: string) => void;
  confirm: (title: string, message: string, action: DialogAction) => void;
};

const DialogContext = createContext<DialogApi | null>(null);

const CONFIRMED = 'confirm';

const BUTTON =
  'h-11 flex-1 rounded-full text-sm font-semibold tracking-tight active:opacity-70';

export function useDialog(): DialogApi {
  const dialog = useContext(DialogContext);

  if (dialog === null) {
    throw new Error('useDialog must be used inside DialogProvider');
  }

  return dialog;
}

export function DialogProvider({children}: {children: ReactNode}) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const messageId = useId();

  const api = useMemo<DialogApi>(
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

    dialog.returnValue = '';
    dialog.showModal();
  }, [request]);

  const onClose = () => {
    const confirmed = dialogRef.current?.returnValue === CONFIRMED;
    const action = request?.action;

    setRequest(null);

    if (confirmed) {
      action?.onPress();
    }
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      <dialog
        ref={dialogRef}
        onClose={onClose}
        onMouseDown={(event) => {
          pressedBackdrop.current = event.target === dialogRef.current;
        }}
        onClick={(event) => {
          // Both mousedown and click must land on the backdrop.
          if (pressedBackdrop.current && event.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className='m-auto w-[calc(100%-40px)] max-w-85 rounded-2xl border border-theme-line bg-theme-surface backdrop:bg-theme-ink/30'
      >
        {request ? (
          <form method='dialog' className='p-5'>
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
                  type='submit'
                  value='cancel'
                  className={`${BUTTON} border border-theme-edge bg-theme-surface text-theme-ink transition-colors hover:bg-theme-sunk`}
                >
                  Avbryt
                </button>
              ) : null}
              <button
                type='submit'
                value={CONFIRMED}
                className={`${BUTTON} bg-theme-ink text-theme-surface transition-opacity hover:opacity-90`}
              >
                {request.action?.label ?? 'OK'}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </DialogContext.Provider>
  );
}
