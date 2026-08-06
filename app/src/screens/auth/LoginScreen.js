import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';
import TextInput from '../../components/ui/TextInput';

export default function LoginScreen() {
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Screen scroll contentClassName="flex-grow justify-center">
      <View className="mb-8">
        <Text className="text-2xl font-bold text-text-primary">Log in</Text>
      </View>

      <TextInput
        label="Email"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        label="Password"
        placeholder="Password"
        secureTextEntry={!showPassword}
        value={password}
        onChangeText={setPassword}
        containerClassName="mb-1"
      />
      <Pressable onPress={() => setShowPassword((prev) => !prev)} className="mb-6 self-end">
        <Text className="text-xs font-medium text-primary">
          {showPassword ? 'Hide password' : 'Show password'}
        </Text>
      </Pressable>

      <Button fullWidth>Log In</Button>

      <Pressable onPress={() => navigation.navigate('RoleSelect')} className="mt-6">
        <Text className="text-center text-sm text-text-secondary">
          Don&apos;t have an account? <Text className="font-semibold text-primary">Sign up</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}
