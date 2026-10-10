import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import {AdminAnnouncements} from '@/admin/AdminAnnouncements';
import {AdminApartments} from '@/admin/AdminApartments';
import {AdminOrganization} from '@/admin/AdminOrganization';
import {AdminResources} from '@/admin/AdminResources';
import {useMessages} from '@/i18n/LocaleProvider';
import {TAB_SCREEN_OPTIONS, TAB_ICON_GLYPH} from '@/navigation/tabOptions';

export type AdminTabParamList = {
  Apartments: undefined;
  Resources: undefined;
  Announcements: undefined;
  Organization: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

export default function AdminTabNavigator() {
  const t = useMessages();

  return (
    <Tab.Navigator screenOptions={TAB_SCREEN_OPTIONS}>
      <Tab.Screen
        name='Apartments'
        component={AdminApartments}
        options={{
          title: t.tabs.apartments,
          tabBarIcon: ({color}) => (
            <Ionicons
              name='people-outline'
              size={TAB_ICON_GLYPH}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name='Resources'
        component={AdminResources}
        options={{
          title: t.tabs.resources,
          tabBarIcon: ({color}) => (
            <Ionicons name='grid-outline' size={TAB_ICON_GLYPH} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name='Announcements'
        component={AdminAnnouncements}
        options={{
          title: t.tabs.announcements,
          tabBarIcon: ({color}) => (
            <Ionicons
              name='megaphone-outline'
              size={TAB_ICON_GLYPH}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name='Organization'
        component={AdminOrganization}
        options={{
          title: t.tabs.organization,
          tabBarIcon: ({color}) => (
            <Ionicons
              name='settings-outline'
              size={TAB_ICON_GLYPH}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
