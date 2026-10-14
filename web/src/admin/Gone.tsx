import {useMessages} from '@/i18n/LocaleProvider';

// A step down to something removed meanwhile, such as an old link. The
// page's back link leads on.
export function Gone() {
  const t = useMessages();

  return <p className='text-sm text-theme-muted'>{t.admin.gone}</p>;
}
