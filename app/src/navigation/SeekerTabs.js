import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import BrowseGigsScreen from '../screens/seeker/BrowseGigsScreen';
import MyApplicationsScreen from '../screens/seeker/MyApplicationsScreen';
import ProfileScreen from '../screens/seeker/ProfileScreen';
import SavedGigsScreen from '../screens/seeker/SavedGigsScreen';
import EmptyState from '../components/ui/EmptyState';
import Screen from '../components/ui/Screen';
import { TAB_BAR_SCREEN_OPTIONS } from './tabBarTheme';

const Tab = createBottomTabNavigator();

const ICONS = {
  Browse: 'search',
  Saved: 'star',
  'My Applications': 'document-text',
  Profile: 'person',
};

// Browse is the one public surface - the other three tabs assume a signed-in
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
        ...TAB_BAR_SCREEN_OPTIONS,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`}
            size={size}
            color={color}
          />
        ),
      })}
    >
      {/* Route name stays "Browse" - MyApplicationsScreen navigates here by
          name (navigation.navigate('Browse')). Only the displayed label
          changes to match the frames. */}
      <Tab.Screen name="Browse" component={BrowseGigsScreen} options={{ tabBarLabel: 'Gigs' }} />
      <Tab.Screen name="Saved">
        {() =>
          guest ? (
            <SignInGate message="Sign in to save gigs." onSignIn={onSignIn} />
          ) : (
            <SavedGigsScreen />
          )
        }
      </Tab.Screen>
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
