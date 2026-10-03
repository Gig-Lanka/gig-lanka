import { useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SchibstedGrotesk_700Bold } from '@expo-google-fonts/schibsted-grotesk';
import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
} from '@expo-google-fonts/inter-tight';

import RootNavigator from './src/navigation/RootNavigator';
import { linkingConfig } from './src/navigation/linking';
import { navigationRef } from './src/navigation/navigationRef';
import useAuth from './src/hooks/useAuth';
import { AUTH_STATUS, AuthProvider } from './src/store/AuthContext';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { status } = useAuth();

  // While signed in, ResetPassword isn't mounted, so letting React Navigation
  // act on a reset link would only dispatch an action nothing handles.
  // useResetLinkRedirect shows the signed-in notice instead. During launch
  // the status is still loading, so the cold-start link is let through; a
  // signed-in AppStack then discards the unknown route when it mounts.
  const linking = useMemo(
    () => ({ ...linkingConfig, filter: () => status !== AUTH_STATUS.AUTHENTICATED }),
    [status],
  );

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SchibstedGrotesk_700Bold,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <AuthProvider>
        <AppContent />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
