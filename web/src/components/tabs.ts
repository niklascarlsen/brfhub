import type {Messages} from '@brfhub/core/i18n/catalog';
import type {ComponentType} from 'react';

import {
  CalendarOutlineIcon,
  HomeOutlineIcon,
  TimeOutlineIcon,
} from '@/components/icons';
import type {IconProps} from '@/components/icons/types';
import type {Route} from '@/lib/route';

// What a page scrolling under the floating bar keeps clear at its end: the
// bar, 66px tall like the app's, and its 20px gap to the bottom edge, the
// page's own end padding being the air. Set on the phone layout's root, so
// the desktop, which has no bar, reads 0.
export const TAB_BAR_CLEARANCE = '[--tab-bar-clearance:86px]';

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
