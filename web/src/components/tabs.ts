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
  {route: 'boka', label: 'Boka', Icon: CalendarOutlineIcon},
  {route: 'mina-tider', label: 'Mina tider', Icon: TimeOutlineIcon},
  {route: 'lagenhet', label: 'Lägenhet', Icon: HomeOutlineIcon},
];
