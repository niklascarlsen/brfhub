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
  label: string;
  Icon: ComponentType<IconProps>;
};

export const MEMBER_TABS: readonly Tab[] = [
  {route: 'book', label: 'Boka', Icon: CalendarOutlineIcon},
  {route: 'my-times', label: 'Mina tider', Icon: TimeOutlineIcon},
  {route: 'apartment', label: 'Lägenhet', Icon: HomeOutlineIcon},
];
