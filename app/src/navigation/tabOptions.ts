import type {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs';

import theme from '@/theme.json';

const BAR_HEIGHT = 49;
const ITEM_PADDING = 5;
const ICON_SLOT = 25;
export const TAB_ICON_GLYPH = 23;
const LABEL_GAP = 1;
const LABEL_LINE = BAR_HEIGHT - ITEM_PADDING * 2 - ICON_SLOT - LABEL_GAP;

// Shared by the apartment's and the admin's tab bars.
export const TAB_SCREEN_OPTIONS: BottomTabNavigationOptions = {
  headerShown: false,
  // The keyboard toolbar sits right on the keyboard, not a tab bar above it.
  tabBarHideOnKeyboard: true,
  tabBarStyle: {
    backgroundColor: theme.bg,
    borderTopColor: theme.line,
    elevation: 0,
  },
  tabBarActiveTintColor: theme.ink,
  tabBarInactiveTintColor: theme.faint,
  tabBarIconStyle: {width: ICON_SLOT, height: ICON_SLOT},
  tabBarLabelStyle: {
    fontFamily: 'Merriweather_600SemiBold',
    fontSize: 11,
    lineHeight: LABEL_LINE,
    marginTop: LABEL_GAP,
  },
};
