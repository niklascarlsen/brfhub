import {LogBox} from 'react-native';

// NativeWind wraps every React Native component as it loads, ImageBackground
// too, which React Native 0.88 deprecates and warns about on first touch. We
// draw none ourselves, so the warning says nothing about this app. Imported
// by index.ts before the app, so the pattern is in place before NativeWind
// loads.
LogBox.ignoreLogs(['ImageBackground is deprecated']);
