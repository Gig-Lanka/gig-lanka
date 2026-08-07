import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { authApi } from '../../api';
import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';
import TextInput from '../../components/ui/TextInput';

export default function LoginScreen() {
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setFormError('');
    setSubmitting(true);
    try {
      await authApi.login({
        email: email.trim().toLowerCase(),
        password,
      });
    } catch (error) {
      const apiError = error.response?.data?.error;
      setFormError(apiError?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
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
          disabled={submitting}
        />

        <TextInput
          label="Password"
          placeholder="Password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          containerClassName="mb-1"
          disabled={submitting}
        />
        <Pressable
          onPress={() => setShowPassword((prev) => !prev)}
          className="mb-6 self-end"
          disabled={submitting}
        >
          <Text className="text-xs font-medium text-primary">
            {showPassword ? 'Hide password' : 'Show password'}
          </Text>
        </Pressable>

        {formError ? <Text className="mb-4 text-sm text-danger-text">{formError}</Text> : null}

        <Button fullWidth onPress={handleSubmit} loading={submitting}>
          Log In
        </Button>

        <Pressable
          onPress={() => navigation.navigate('RoleSelect')}
          className="mt-6"
          disabled={submitting}
        >
          <Text className="text-center text-sm text-text-secondary">
            Don&apos;t have an account? <Text className="font-semibold text-primary">Sign up</Text>
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
