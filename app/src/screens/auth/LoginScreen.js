import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { authApi } from '../../api';
import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
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
    <AuthShell
      scroll
      header={
        <>
          <Brand />
          <Text className="mt-8 font-display text-h1 text-paper">Log in</Text>
          <Text className="mt-3 text-lede text-muted-dark">
            Welcome back. Pick up where you left off.
          </Text>
        </>
      }
    >
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
        containerClassName="mb-0"
        disabled={submitting}
      />
      <Pressable
        onPress={() => setShowPassword((prev) => !prev)}
        className="mb-7 mt-3 self-end"
        disabled={submitting}
      >
        <Text className="text-[13px] font-semibold text-ink">
          {showPassword ? 'Hide password' : 'Show password'}
        </Text>
      </Pressable>

      {formError ? (
        <Notice variant="error" className="mb-4">
          {formError}
        </Notice>
      ) : null}

      <Button fullWidth trailingArrow onPress={handleSubmit} loading={submitting}>
        Log In
      </Button>

      <View className="flex-1" />

      <Pressable
        onPress={() => navigation.navigate('RoleSelect')}
        className="py-6"
        disabled={submitting}
      >
        <Text className="text-center text-[14.5px] text-muted">
          Don&apos;t have an account? <Text className="font-semibold text-signal">Sign up</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
