import type {Messages} from '@booking/core/i18n/catalog';
import type {ComponentType} from 'react';

import {
  CalendarOutlineIcon,
  HomeOutlineIcon,
  TimeOutlineIcon,
} from '@/components/icons';
import type {IconProps} from '@/components/icons/types';
import type {Route} from '@/lib/route';

export type Tab = {
  route: Route;
  label: (t: Messages) => string;
  Icon: ComponentType<IconProps>;
};

export const MEMBER_TABS: readonly Tab[] = [
  {route: 'book', label: (t) => t.tabs.book, Icon: CalendarOutlineIcon},
  {route: 'my-times', label: (t) => t.tabs.myTimes, Icon: TimeOutlineIcon},
  {route: 'apartment', label: (t) => t.tabs.apartment, Icon: HomeOutlineIcon},
];
