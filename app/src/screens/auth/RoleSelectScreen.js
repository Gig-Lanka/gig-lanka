import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Screen from '../../components/ui/Screen';

const ROLES = [
  {
    role: 'seeker',
    title: "I'm looking for work",
    description: 'Browse gigs, apply, and get hired by businesses near you.',
    label: 'Continue as a seeker',
  },
  {
    role: 'business',
    title: "I'm hiring",
    description: 'Post gigs and find people to get the work done.',
    label: 'Continue as a business',
  },
];

function RoleOption({ title, description, label, onSelect }) {
  return (
    <Card className="gap-3">
      <View>
        <Text className="text-lg font-semibold text-text-primary">{title}</Text>
        <Text className="mt-1 text-sm text-text-secondary">{description}</Text>
      </View>
      <Button onPress={onSelect} fullWidth>
        {label}
      </Button>
    </Card>
  );
}

export default function RoleSelectScreen() {
  const navigation = useNavigation();

  const selectRole = (role) => {
    navigation.navigate('SignUp', { role });
  };

  return (
    <Screen>
      <View className="mt-8 mb-8">
        <Text className="text-2xl font-bold text-text-primary">Join Gig Lanka</Text>
        <Text className="mt-1 text-base text-text-secondary">
          Choose how you'll use the app. You can't change this later.
        </Text>
      </View>

      <View className="gap-4">
        {ROLES.map(({ role, title, description, label }) => (
          <RoleOption
            key={role}
            title={title}
            description={description}
            label={label}
            onSelect={() => selectRole(role)}
          />
        ))}
      </View>
    </Screen>
  );
}
