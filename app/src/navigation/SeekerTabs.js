import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import BrowseScreen from '../screens/seeker/BrowseScreen';
import MyApplicationsScreen from '../screens/seeker/MyApplicationsScreen';
import ProfileScreen from '../screens/seeker/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Browse: 'search',
  'My Applications': 'document-text',
  Profile: 'person',
};

export default function SeekerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
      <Tab.Screen name="Browse" component={BrowseScreen} />
      <Tab.Screen name="My Applications" component={MyApplicationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
