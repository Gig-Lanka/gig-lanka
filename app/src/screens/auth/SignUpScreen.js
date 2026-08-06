import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { authApi } from '../../api';
import Button from '../../components/ui/Button';
import Dropdown from '../../components/ui/Dropdown';
import Screen from '../../components/ui/Screen';
import TextInput from '../../components/ui/TextInput';
import { validateSignUpForm } from '../../utils/validation';

const ROLE_OPTIONS = [
  { label: "I'm looking for work", value: 'seeker' },
  { label: "I'm hiring", value: 'business' },
];

export default function SignUpScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [role, setRole] = useState(route.params?.role);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const validationErrors = validateSignUpForm({ email, password, confirmPassword });
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.register({
        email: email.trim().toLowerCase(),
        password,
        role,
      });
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'EMAIL_ALREADY_EXISTS') {
        setErrors({ email: apiError.message });
      } else if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        apiError.errors.forEach(({ field, message }) => {
          fieldErrors[field] = message;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(apiError?.message || 'Something went wrong. Please try again.');
      }
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
        <View className="mb-6 mt-8">
          <Text className="text-2xl font-bold text-text-primary">Create your account</Text>
        </View>

        <Dropdown
          label="Role"
          options={ROLE_OPTIONS}
          value={role}
          onChange={setRole}
          disabled={submitting}
        />

        <TextInput
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          disabled={submitting}
        />
        <TextInput
          label="Password"
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          disabled={submitting}
        />
        <TextInput
          label="Confirm password"
          placeholder="Confirm password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          disabled={submitting}
        />

        {formError ? <Text className="mb-4 text-sm text-danger-text">{formError}</Text> : null}

        <Button onPress={handleSubmit} fullWidth loading={submitting}>
          Sign Up
        </Button>

        <Pressable
          onPress={() => navigation.navigate('Login')}
          className="mt-6"
          disabled={submitting}
        >
          <Text className="text-center text-sm text-text-secondary">
            Already have an account? <Text className="font-semibold text-primary">Log in</Text>
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
