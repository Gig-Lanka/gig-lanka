import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import ApplicantsScreen from '../screens/business/ApplicantsScreen';
import MyGigsScreen from '../screens/business/MyGigsScreen';
import ProfileScreen from '../screens/business/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  'My Gigs': 'briefcase',
  Applicants: 'people',
  Profile: 'person',
};

export default function BusinessTabs() {
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
      <Tab.Screen name="My Gigs" component={MyGigsScreen} />
      <Tab.Screen name="Applicants" component={ApplicantsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
