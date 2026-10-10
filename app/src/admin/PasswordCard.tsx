import {Pressable, Share, Text, View} from 'react-native';

import {
  CARD,
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import type {Apartment} from '@/api/client';
import {useMessages} from '@/i18n/LocaleProvider';

type PasswordCardProps = {
  apartment: Apartment;
  password: string;
  onDone: () => void;
};

// The only time the password is shown: the server keeps nothing but its
// hash, so it has to be written down or passed on now.
export function PasswordCard({apartment, password, onDone}: PasswordCardProps) {
  const t = useMessages();

  const share = () => {
    void Share.share({
      message: t.admin.password.login(
        apartment.label,
        apartment.email,
        password,
      ),
    });
  };

  return (
    <View className='gap-4'>
      <View className={`${CARD} gap-3`}>
        <Text className='text-sm font-semibold text-theme-muted'>
          {t.admin.password.title(apartment.label)}
        </Text>
        <Text
          selectable
          className='text-[26px] font-semibold tracking-wide text-theme-ink'
          style={{fontVariant: ['tabular-nums']}}
        >
          {password}
        </Text>
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          {t.admin.password.beforeEmail}{' '}
          <Text className='text-theme-ink'>{apartment.email}</Text>
          {t.admin.password.afterEmail}
        </Text>
      </View>
      <View className='flex-row flex-wrap gap-2.5'>
        <Pressable onPress={share} className={SECONDARY_BUTTON}>
          <Text className={SECONDARY_LABEL}>{t.admin.password.share}</Text>
        </Pressable>
        <Pressable onPress={onDone} className={PRIMARY_BUTTON}>
          <Text className={PRIMARY_LABEL}>{t.admin.password.done}</Text>
        </Pressable>
      </View>
    </View>
  );
}
