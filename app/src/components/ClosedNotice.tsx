import type {Resource} from '@brfhub/core/api/types';
import {closedNotice} from '@brfhub/core/booking/closing';
import {Text, View} from 'react-native';

import {Icon} from '@/components/Icon';
import {useMessages} from '@/i18n/LocaleProvider';
import {theme} from '@/theme';

// What a closed resource shows in place of its slots: that it cannot be
// booked, and what the admin says about it.
export function ClosedNotice({resource}: {resource: Resource}) {
  const t = useMessages();
  const {title, message} = closedNotice(resource, t);

  return (
    <View className='flex-row gap-3 rounded-card border border-theme-line bg-theme-sunk px-[18px] py-4'>
      <Icon
        name='lock-closed'
        size={16}
        color={theme.muted}
        style={{marginTop: 2}}
      />
      <View className='min-w-0 flex-1 gap-1'>
        <Text className='text-sm font-semibold text-theme-ink'>{title}</Text>
        <Text className='font-sans text-sm leading-5 text-theme-muted'>
          {message}
        </Text>
      </View>
    </View>
  );
}
