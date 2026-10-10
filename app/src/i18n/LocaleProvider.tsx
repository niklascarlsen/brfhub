import {useLocales} from 'expo-localization';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  CATALOGS,
  resolveLocale,
  type Locale,
  type LocaleChoice,
  type Messages,
} from '@/i18n/catalog';
import {readLocaleChoice, saveLocaleChoice} from '@/lib/locale';

type LocaleValue = {
  locale: Locale;
  messages: Messages;
  choice: LocaleChoice;
  setChoice: (choice: LocaleChoice) => void;
};

const LocaleContext = createContext<LocaleValue | null>(null);

function useLocaleValue(): LocaleValue {
  const value = useContext(LocaleContext);

  if (value === null) {
    throw new Error('useMessages must be used inside LocaleProvider');
  }

  return value;
}

export function useMessages(): Messages {
  return useLocaleValue().messages;
}

export function useLocale(): Omit<LocaleValue, 'messages'> {
  const {locale, choice, setChoice} = useLocaleValue();
  return {locale, choice, setChoice};
}

// The language the person picked on this device, or the first of the
// device's languages the app speaks. A change in the device settings
// renders again with the new list.
export function LocaleProvider({children}: {children: ReactNode}) {
  const deviceLocales = useLocales();
  const [choice, setStoredChoice] = useState(readLocaleChoice);
  const locale = resolveLocale(
    choice,
    deviceLocales.map((item) => item.languageCode ?? item.languageTag),
  );

  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      messages: CATALOGS[locale],
      choice,
      setChoice: (next) => {
        saveLocaleChoice(next);
        setStoredChoice(next);
      },
    }),
    [locale, choice],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
