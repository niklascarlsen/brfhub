import './global.css';

import {NavigationContainer} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';

import AppTabNavigator from '@/navigation/AppTabNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <AppTabNavigator />
      <StatusBar style='dark' />
    </NavigationContainer>
  );
}
