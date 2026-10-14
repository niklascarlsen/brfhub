import {Text} from 'react-native';

import {useMessages} from '@/i18n/LocaleProvider';

// A step down to something removed meanwhile. The page's back link leads
// on.
export function Gone() {
  const t = useMessages();

  return (
    <Text className='font-sans text-sm text-theme-muted'>{t.admin.gone}</Text>
  );
}
