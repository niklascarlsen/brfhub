import {useId} from 'react';

import {CATALOGS, type LocaleChoice} from '@/i18n/catalog';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

// Each language is named in itself, so it can be found whatever the page is
// shown in.
export function LanguagePicker() {
  const t = useMessages();
  const {choice, setChoice, locales} = useLocale();
  const headingId = useId();

  // An organization that writes in one language shows only that one.
  if (locales.length < 2) {
    return null;
  }

  const options: {value: LocaleChoice; label: string; lang?: string}[] = [
    {value: 'system', label: t.language.system},
    ...locales.map((locale) => ({
      value: locale,
      label: CATALOGS[locale].language.name,
      lang: locale,
    })),
  ];

  return (
    <div className='mb-6.5'>
      <p
        id={headingId}
        className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
      >
        {t.language.heading}
      </p>
      <div
        role='group'
        aria-labelledby={headingId}
        className='flex flex-wrap gap-2'
      >
        {options.map(({value, label, lang}) => {
          const selected = value === choice;

          return (
            <button
              key={value}
              type='button'
              lang={lang}
              aria-pressed={selected}
              onClick={() => setChoice(value)}
              className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                selected
                  ? 'border-theme-ink bg-theme-ink text-theme-surface'
                  : 'border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
