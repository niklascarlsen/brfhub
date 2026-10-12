import {CATALOGS, type LocaleChoice} from '@booking/core/i18n/catalog';
import {Pressable, Text, View} from 'react-native';

import {useLocale, useMessages} from '@/i18n/LocaleProvider';

// Each language is named in itself, so it can be found whatever the app is
// shown in.
export function LanguagePicker() {
  const t = useMessages();
  const {choice, setChoice, locales} = useLocale();

  // An organization that writes in one language shows only that one.
  if (locales.length < 2) {
    return null;
  }

  const options: {value: LocaleChoice; label: string}[] = [
    {value: 'system', label: t.language.system},
    ...locales.map((locale) => ({
      value: locale,
      label: CATALOGS[locale].language.name,
    })),
  ];

  return (
    <View className='mb-[26px]'>
      <Text
        accessibilityRole='header'
        className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
      >
        {t.language.heading}
      </Text>
      <View className='flex-row flex-wrap gap-2'>
        {options.map(({value, label}) => {
          const selected = value === choice;

          return (
            <Pressable
              key={value}
              accessibilityRole='button'
              accessibilityState={{selected}}
              onPress={() => setChoice(value)}
              className={`h-10 justify-center rounded-full border px-4 ${
                selected
                  ? 'border-theme-ink bg-theme-ink'
                  : 'border-theme-edge bg-theme-surface active:bg-theme-sunk'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  selected ? 'text-theme-surface' : 'text-theme-ink'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
