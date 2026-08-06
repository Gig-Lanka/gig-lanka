import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { authApi } from '../../api';
import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';
import TextInput from '../../components/ui/TextInput';
import { validateSignUpForm } from '../../utils/validation';

const ROLE_LABELS = {
  seeker: "I'm looking for work",
  business: "I'm hiring",
};

export default function SignUpScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const role = route.params?.role;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});

  const handleSubmit = () => {
    const validationErrors = validateSignUpForm({ email, password, confirmPassword });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    authApi
      .register({
        email: email.trim().toLowerCase(),
        password,
        role,
      })
      .catch(() => {
        // Server-error surfacing and the post-signup auth-state handoff are separate work.
      });
  };

  return (
    <Screen scroll>
      <View className="mb-6 mt-8">
        <Text className="text-2xl font-bold text-text-primary">Create your account</Text>
      </View>

      <View className="mb-6 flex-row items-center justify-between rounded-md border border-border bg-bg-card px-4 py-3">
        <Text className="text-sm text-text-secondary">
          Signing up as{' '}
          <Text className="font-semibold text-text-primary">{ROLE_LABELS[role] ?? role}</Text>
        </Text>
        <Button variant="outline" size="small" onPress={() => navigation.goBack()}>
          Change
        </Button>
      </View>

      <TextInput
        label="Email"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      <TextInput
        label="Password"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <TextInput
        label="Confirm password"
        placeholder="Confirm password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
      />

      <Button onPress={handleSubmit} fullWidth>
        Sign Up
      </Button>

      <Pressable onPress={() => navigation.navigate('Login')} className="mt-6">
        <Text className="text-center text-sm text-text-secondary">
          Already have an account? <Text className="font-semibold text-primary">Log in</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}
