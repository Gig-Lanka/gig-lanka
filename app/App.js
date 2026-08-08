import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Loader from './src/components/ui/Loader';
import useAuth from './src/hooks/useAuth';
import RootNavigator from './src/navigation/RootNavigator';
import { AUTH_STATUS, AuthProvider } from './src/store/AuthContext';

function AppContent() {
  const { status } = useAuth();

  if (status === AUTH_STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
