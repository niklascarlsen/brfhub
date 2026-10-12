import {
  CATALOGS,
  LOCALES,
  resolveLocale,
  type Locale,
  type LocaleChoice,
  type Messages,
} from '@booking/core/i18n/catalog';
import {useLocales} from 'expo-localization';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  readLocaleChoice,
  saveLocaleChoice,
  setRequestLocale,
} from '@/lib/locale';

type LocaleValue = {
  locale: Locale;
  // The languages that can be shown: the organization's once signed in.
  locales: readonly Locale[];
  messages: Messages;
  choice: LocaleChoice;
  setChoice: (choice: LocaleChoice) => void;
  // Set with the account, in the same render, so its screens never show
  // in a language the organization does not write in. Null when signed
  // out.
  setOrganizationLocales: (locales: Locale[] | null) => void;
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
  const {locale, locales, choice, setChoice, setOrganizationLocales} =
    useLocaleValue();
  return {locale, locales, choice, setChoice, setOrganizationLocales};
}

// The language the person picked on this device, or the first of the
// device's languages the app speaks, among those the organization writes
// in. A change in the device settings renders again with the new list.
export function LocaleProvider({children}: {children: ReactNode}) {
  const deviceLocales = useLocales();
  const [choice, setStoredChoice] = useState(readLocaleChoice);
  const [organizationLocales, setOrganizationLocales] = useState<
    Locale[] | null
  >(null);
  const locales = organizationLocales ?? LOCALES;
  const locale = resolveLocale(
    choice,
    deviceLocales.map((item) => item.languageCode ?? item.languageTag),
    locales,
  );

  // Before the screens below load anything, so they ask in this language.
  useLayoutEffect(() => {
    setRequestLocale(locale);
  }, [locale]);

  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      locales,
      messages: CATALOGS[locale],
      choice,
      setChoice: (next) => {
        saveLocaleChoice(next);
        setStoredChoice(next);
      },
      setOrganizationLocales,
    }),
    [locale, locales, choice],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
