import './global.css';

import {NavigationContainer} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';

import {BookingsProvider} from '@/context/BookingsContext';
import AppTabNavigator from '@/navigation/AppTabNavigator';

export default function App() {
  return (
    <BookingsProvider>
      <NavigationContainer>
        <AppTabNavigator />
        <StatusBar style='dark' />
      </NavigationContainer>
    </BookingsProvider>
  );
}
