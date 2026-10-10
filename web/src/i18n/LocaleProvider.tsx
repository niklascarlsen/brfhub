import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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

function subscribeToLanguages(onChange: () => void) {
  window.addEventListener('languagechange', onChange);
  return () => window.removeEventListener('languagechange', onChange);
}

// Joined, so the snapshot stays equal until the browser's list changes.
function browserLanguages(): string {
  return navigator.languages.join(',');
}

// The language the person picked in this browser, or the first of the
// browser's languages the app speaks.
export function LocaleProvider({children}: {children: ReactNode}) {
  const languages = useSyncExternalStore(
    subscribeToLanguages,
    browserLanguages,
  );
  const [choice, setStoredChoice] = useState(readLocaleChoice);
  const locale = resolveLocale(choice, languages.split(','));

  // Screen readers and the browser's own spelling follow the page language.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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
