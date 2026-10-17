import type {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs';

export const TAB_ICON_GLYPH = 23;

// Shared by the apartment's and the admin's tab bars, both drawn by
// TabBar in src/components.
export const TAB_SCREEN_OPTIONS: BottomTabNavigationOptions = {
  headerShown: false,
};
