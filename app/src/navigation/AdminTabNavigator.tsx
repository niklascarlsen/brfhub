import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import {AdminApartments} from '@/admin/AdminApartments';
import {AdminOrganization} from '@/admin/AdminOrganization';
import {AdminResources} from '@/admin/AdminResources';
import {TAB_SCREEN_OPTIONS, TAB_ICON_GLYPH} from '@/navigation/tabOptions';

export type AdminTabParamList = {
  Apartments: undefined;
  Resources: undefined;
  Organization: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

export default function AdminTabNavigator() {
  return (
    <Tab.Navigator screenOptions={TAB_SCREEN_OPTIONS}>
      <Tab.Screen
        name='Apartments'
        component={AdminApartments}
        options={{
          title: 'Lägenheter',
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
          title: 'Resurser',
          tabBarIcon: ({color}) => (
            <Ionicons name='grid-outline' size={TAB_ICON_GLYPH} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name='Organization'
        component={AdminOrganization}
        options={{
          title: 'Föreningen',
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
