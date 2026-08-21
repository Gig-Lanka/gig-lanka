import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import TextInput from '../../components/ui/TextInput';
import useAuth from '../../hooks/useAuth';
import { getPasswordStrength, isValidPassword } from '../../utils/validation';

const STRENGTH_BAR_STYLES = {
  weak: 'bg-danger',
  medium: 'bg-strength-medium',
  strong: 'bg-success-ink',
};

const STRENGTH_LABEL_STYLES = {
  weak: 'text-danger-ink',
  medium: 'text-warning-ink',
  strong: 'text-success-ink',
};

// docs/mockups/gig-lanka-user-profile-v3.html#change-password - three bars,
// filled left to right, label reads as an instruction rather than a verdict.
function StrengthMeter({ password }) {
  const strength = getPasswordStrength(password);
  if (!strength) return null;

  return (
    <View className="-mt-2 mb-4">
      <View className="flex-row gap-[6px]">
        {[1, 2, 3].map((bar) => (
          <View
            key={bar}
            className={[
              'h-1 flex-1 rounded-full',
              bar <= strength.filledBars ? STRENGTH_BAR_STYLES[strength.level] : 'bg-line',
            ].join(' ')}
          />
        ))}
      </View>
      <Text
        className={[
          'mt-[7px] text-[11.5px] font-semibold',
          STRENGTH_LABEL_STYLES[strength.level],
        ].join(' ')}
      >
        {strength.label}
      </Text>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    currentPassword.length > 0 && isValidPassword(newPassword) && confirmPassword === newPassword;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setFormError('');
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      navigation.goBack();
    } catch (error) {
      setFormError(
        error.response?.data?.error?.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader
        title="Change password"
        small
        onBack={submitting ? undefined : () => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-[22px] pb-6"
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          label="Current password"
          placeholder="Current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          disabled={submitting}
        />

        <TextInput
          label="New password"
          placeholder="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          disabled={submitting}
          containerClassName="mb-1"
        />
        <StrengthMeter password={newPassword} />

        <TextInput
          label="Confirm new password"
          placeholder="Confirm new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          disabled={submitting}
        />

        <Notice>Saving this signs you out of every other device automatically.</Notice>

        {formError ? (
          <Notice variant="error" className="mt-4">
            {formError}
          </Notice>
        ) : null}
      </ScrollView>

      <View className="border-t border-line px-[22px] pb-3 pt-3">
        <Button onPress={handleSubmit} loading={submitting} disabled={!canSubmit}>
          Update password
        </Button>
      </View>
    </SafeAreaView>
  );
}
