import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Screen from '../../components/ui/Screen';

const ROLES = [
  {
    role: 'seeker',
    title: "I'm looking for work",
    description: 'Browse gigs, apply, and get hired by businesses near you.',
  },
  {
    role: 'business',
    title: "I'm hiring",
    description: 'Post gigs and find people to get the work done.',
  },
];

function RoleOption({ title, description, selected, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <Card className={selected ? 'border-2 border-primary bg-primary-soft' : 'border-2 border-transparent'}>
        <Text className="text-lg font-semibold text-text-primary">{title}</Text>
        <Text className="mt-1 text-sm text-text-secondary">{description}</Text>
      </Card>
    </Pressable>
  );
}

export default function RoleSelectScreen() {
  const navigation = useNavigation();
  const [selectedRole, setSelectedRole] = useState(null);

  const handleNext = () => {
    if (!selectedRole) return;
    navigation.navigate('SignUp', { role: selectedRole });
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
        {ROLES.map(({ role, title, description }) => (
          <RoleOption
            key={role}
            title={title}
            description={description}
            selected={selectedRole === role}
            onPress={() => setSelectedRole(role)}
          />
        ))}
      </View>

      <View className="mb-4 mt-auto">
        <Button onPress={handleNext} disabled={!selectedRole} fullWidth>
          Next
        </Button>
      </View>
    </Screen>
  );
}
