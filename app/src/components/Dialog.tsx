import type {Dialog, DialogChoice} from '@booking/core/lib/dialog';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {Alert, Modal, Pressable, Text, View} from 'react-native';

import {useMessages} from '@/i18n/LocaleProvider';

type ChoiceRequest = {
  title: string;
  message: string;
  choices: DialogChoice[];
};

const DialogContext = createContext<Dialog | null>(null);

export function useDialog(): Dialog {
  const dialog = useContext(DialogContext);

  if (dialog === null) {
    throw new Error('useDialog must be used inside DialogProvider');
  }

  return dialog;
}

// The platform's own alert, in the same shape as the web's dialog. A
// choice can be longer than an alert holds, Android's three buttons, so it
// gets a dialog of its own.
export function DialogProvider({children}: {children: ReactNode}) {
  const t = useMessages();
  const [request, setRequest] = useState<ChoiceRequest | null>(null);

  const dialog = useMemo<Dialog>(
    () => ({
      alert: (title, message) => Alert.alert(title, message),
      confirm: (title, message, action) =>
        Alert.alert(title, message, [
          {text: action.cancelLabel ?? t.common.cancel, style: 'cancel'},
          action.destructive
            ? {
                text: action.label,
                style: 'destructive',
                onPress: action.onPress,
              }
            : {text: action.label, isPreferred: true, onPress: action.onPress},
        ]),
      choose: (title, message, choices) =>
        setRequest({title, message, choices}),
    }),
    [t],
  );

  const close = () => setRequest(null);

  return (
    <DialogContext.Provider value={dialog}>
      {children}
      <Modal
        visible={request !== null}
        transparent
        animationType='fade'
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable
          className='flex-1 items-center justify-center bg-theme-ink/30 px-5'
          onPress={close}
          accessible={false}
        >
          {request ? (
            <Pressable
              className='w-full max-w-[340px] rounded-2xl border border-theme-line bg-theme-surface p-5'
              accessibilityRole='alert'
            >
              <Text className='text-[17px] font-semibold tracking-tight text-theme-ink'>
                {request.title}
              </Text>
              <Text className='mt-1.5 font-sans text-sm leading-5 text-theme-muted'>
                {request.message}
              </Text>
              <View className='mt-5 gap-2'>
                {request.choices.map((choice) => (
                  <Pressable
                    key={choice.label}
                    accessibilityRole='button'
                    onPress={() => {
                      close();
                      choice.onPress();
                    }}
                    className='min-h-11 justify-center rounded-xl border border-theme-line bg-theme-surface px-4 py-2.5 active:opacity-70'
                  >
                    <Text className='text-sm font-medium text-theme-ink'>
                      {choice.label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole='button'
                  onPress={close}
                  className='mt-1 h-11 items-center justify-center rounded-full border border-theme-edge bg-theme-surface active:opacity-70'
                >
                  <Text className='text-sm font-semibold tracking-tight text-theme-ink'>
                    {t.common.cancel}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}
