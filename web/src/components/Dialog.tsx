import {
  dismissLabel,
  optionLabels,
  type Dialog,
  type DialogAction,
  type DialogChoice,
  type DialogTime,
} from '@brfhub/core/lib/dialog';
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

import {ChevronForwardIcon} from '@/components/icons';
import {useMessages} from '@/i18n/LocaleProvider';

type DialogRequest = {
  title: string;
  message: string;
  action?: DialogAction;
  choices?: DialogChoice[];
  choicesLabel?: string;
  times?: DialogTime[];
};

const DialogContext = createContext<Dialog | null>(null);

const BUTTON =
  'h-12 flex-1 rounded-full text-[15px] font-semibold tracking-tight active:opacity-70';

const CAPTION = 'text-[11px] font-bold tracking-[1px] uppercase';

// A time given up is red and one gained green, so the two read apart at a
// glance.
const TONES = {
  old: {card: 'bg-theme-danger-tint', caption: 'text-theme-danger'},
  new: {card: 'bg-theme-mist', caption: 'text-theme-accent'},
  none: {card: 'bg-theme-sunk', caption: 'text-theme-muted'},
};

// A time under the message: what it is to the question, where and when.
function TimeLines({time}: {time: DialogTime}) {
  return (
    <>
      {time.caption ? (
        <span
          className={`mb-1 block ${CAPTION} ${TONES[time.tone ?? 'none'].caption}`}
        >
          {time.caption}
        </span>
      ) : null}
      <span className='block text-[15px] font-semibold tracking-tight text-theme-ink'>
        {time.resource}
      </span>
      <span className='mt-0.5 block text-[13px] leading-5 text-theme-muted'>
        {time.when}
      </span>
    </>
  );
}

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
  const timesId = useId();
  const optionsId = useId();

  const api = useMemo<Dialog>(
    () => ({
      alert: (title, message) => setRequest({title, message}),
      confirm: (title, message, action, times) =>
        setRequest({title, message, action, times}),
      choose: (title, message, choices, options) =>
        setRequest({title, message, choices, ...options}),
    }),
    [],
  );

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || request === null || dialog.open) {
      return;
    }

    dialog.showModal();
    // The dialog itself takes focus rather than its first button, so a
    // screen reader reads what it asks, the times and the buttons before
    // any one of them. Tab then reaches the buttons.
    dialog.focus();
  }, [request]);

  const close = () => {
    setRequest(null);
    dialogRef.current?.close();
  };

  // Closing without the action, by its button, Escape or the backdrop.
  const dismiss = () => {
    const onDismiss = request?.action?.onDismiss;
    close();
    onDismiss?.();
  };

  // The action has to run inside the click, or Safari drops the user gesture.
  const press = (onPress?: () => void) => {
    close();
    onPress?.();
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      <dialog
        ref={dialogRef}
        onCancel={dismiss}
        onMouseDown={(event) => {
          pressedBackdrop.current = event.target === dialogRef.current;
        }}
        onClick={(event) => {
          // Both mousedown and click must land on the backdrop.
          if (pressedBackdrop.current && event.target === dialogRef.current) {
            dismiss();
          }
        }}
        tabIndex={-1}
        // Everything is in the name, which a screen reader always reads as
        // focus lands, where a description is often left out.
        aria-labelledby={[
          titleId,
          messageId,
          request?.times ? timesId : null,
          optionsId,
        ]
          .filter(Boolean)
          .join(' ')}
        className='m-auto focus-visible:outline-none w-[calc(100%-40px)] max-w-85 rounded-card border border-theme-line bg-theme-surface backdrop:bg-theme-scrim'
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
              className='mt-1.5 text-sm leading-5 whitespace-pre-line text-theme-muted'
            >
              {request.message}
            </p>
            <p id={optionsId} className='sr-only'>
              {t.common.dialogOptions(optionLabels(request, t))}
            </p>
            {request.times ? (
              <div id={timesId} className='mt-4 flex flex-col gap-2'>
                {request.times.map((time) => (
                  <p
                    key={`${time.caption}${time.when}`}
                    className={`rounded-xl px-3.5 py-2.5 ${TONES[time.tone ?? 'none'].card}`}
                  >
                    <TimeLines time={time} />
                  </p>
                ))}
              </div>
            ) : null}
            {request.choices ? (
              <div className='mt-5 flex flex-col gap-2'>
                {request.choicesLabel ? (
                  <p className={`${CAPTION} text-theme-muted`}>
                    {request.choicesLabel}
                  </p>
                ) : null}
                {request.choices.map((choice) => (
                  <button
                    key={choice.label}
                    type='button'
                    onClick={() => press(choice.onPress)}
                    aria-label={choice.time ? choice.label : undefined}
                    className='flex min-h-12 items-center gap-3 rounded-xl border border-theme-edge bg-theme-surface px-4 py-2.5 text-left text-sm font-medium text-theme-ink transition-colors hover:border-theme-danger-line hover:bg-theme-danger-wash active:opacity-70'
                  >
                    <span className='min-w-0 flex-1'>
                      {choice.time ? (
                        <TimeLines time={choice.time} />
                      ) : (
                        choice.label
                      )}
                    </span>
                    <ChevronForwardIcon
                      size={16}
                      className='shrink-0 text-theme-faint'
                    />
                  </button>
                ))}
                <button
                  type='button'
                  onClick={close}
                  className={`${BUTTON} mt-2 w-full flex-none border border-theme-edge bg-theme-surface text-theme-ink transition-colors hover:bg-theme-sunk`}
                >
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <div className='mt-6 flex gap-2.5'>
                {request.action ? (
                  <button
                    type='button'
                    onClick={dismiss}
                    className={`${BUTTON} border border-theme-edge bg-theme-surface text-theme-ink transition-colors hover:bg-theme-sunk`}
                  >
                    {dismissLabel(request.action, t)}
                  </button>
                ) : null}
                <button
                  type='button'
                  onClick={() => press(request.action?.onPress)}
                  className={`${BUTTON} bg-theme-ink text-theme-surface transition-opacity hover:opacity-90`}
                >
                  {request.action?.label ?? t.common.ok}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </dialog>
    </DialogContext.Provider>
  );
}
