import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Icon} from '@/components/Icon';
import {TabBar} from '@/components/TabBar';

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
    <Tab.Navigator
      screenOptions={TAB_SCREEN_OPTIONS}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen
        name='Apartments'
        component={AdminApartments}
        options={{
          title: t.tabs.apartments,
          tabBarIcon: ({color}) => (
            <Icon name='people-outline' size={TAB_ICON_GLYPH} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name='Resources'
        component={AdminResources}
        options={{
          title: t.tabs.resources,
          tabBarIcon: ({color}) => (
            <Icon name='grid-outline' size={TAB_ICON_GLYPH} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name='Announcements'
        component={AdminAnnouncements}
        options={{
          title: t.tabs.announcements,
          tabBarIcon: ({color}) => (
            <Icon
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
            <Icon name='settings-outline' size={TAB_ICON_GLYPH} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
