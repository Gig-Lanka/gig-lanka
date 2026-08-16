import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import BrowseGigsScreen from '../screens/seeker/BrowseGigsScreen';
import MyApplicationsScreen from '../screens/seeker/MyApplicationsScreen';
import ProfileScreen from '../screens/seeker/ProfileScreen';
import EmptyState from '../components/ui/EmptyState';
import Screen from '../components/ui/Screen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Browse: 'search',
  'My Applications': 'document-text',
  Profile: 'person',
};

// Browse is the one public surface — the other two tabs assume a signed-in
// user, so guest mode swaps them for a sign-in prompt instead of rendering
// screens that have nothing to show without an account.
function SignInGate({ message, onSignIn }) {
  return (
    <Screen>
      <EmptyState message={message} actionLabel="Sign in" onAction={onSignIn} />
    </Screen>
  );
}

export default function SeekerTabs({ guest = false, onSignIn }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#5b4bff',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Browse" component={BrowseGigsScreen} />
      <Tab.Screen name="My Applications">
        {() =>
          guest ? (
            <SignInGate message="Sign in to see your applications." onSignIn={onSignIn} />
          ) : (
            <MyApplicationsScreen />
          )
        }
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() =>
          guest ? (
            <SignInGate message="Sign in to view your profile." onSignIn={onSignIn} />
          ) : (
            <ProfileScreen />
          )
        }
      </Tab.Screen>
    </Tab.Navigator>
  );
}
