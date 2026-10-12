import {
  CATALOGS,
  LOCALES,
  resolveLocale,
  type Locale,
  type LocaleChoice,
  type Messages,
} from '@booking/core/i18n/catalog';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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

function subscribeToLanguages(onChange: () => void) {
  window.addEventListener('languagechange', onChange);
  return () => window.removeEventListener('languagechange', onChange);
}

// Joined, so the snapshot stays equal until the browser's list changes.
function browserLanguages(): string {
  return navigator.languages.join(',');
}

// The language the person picked in this browser, or the first of the
// browser's languages the app speaks, among those the organization writes
// in.
export function LocaleProvider({children}: {children: ReactNode}) {
  const languages = useSyncExternalStore(
    subscribeToLanguages,
    browserLanguages,
  );
  const [choice, setStoredChoice] = useState(readLocaleChoice);
  const [organizationLocales, setOrganizationLocales] = useState<
    Locale[] | null
  >(null);
  const locales = organizationLocales ?? LOCALES;
  const locale = resolveLocale(choice, languages.split(','), locales);

  // Before the screens below load anything, so they ask in this language.
  useLayoutEffect(() => {
    setRequestLocale(locale);
  }, [locale]);

  // Screen readers and the browser's own spelling follow the page language.
  useEffect(() => {
    document.documentElement.lang = locale;
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
