import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';

import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter';
import TextInput from '../../components/ui/TextInput';
import { isValidPassword } from '../../utils/validation';

// docs/mockups/gig-lanka-user-profile-v3.html#reset-password - no back
// control (AC6): arriving from an emailed link means there's no previous
// screen in the stack, so AuthShell's header carries no back affordance
// here, unlike ForgotPasswordScreen's.
export default function ResetPasswordScreen() {
  const route = useRoute();
  // The token does not carry an email, and the API must not return one
  // before the reset succeeds - that would make the token an address-lookup
  // oracle (parent story's Technical notes). `email` is only ever what an
  // in-app continuous flow passed through; there is no endpoint to fetch it.
  const { email } = route.params ?? {};

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const canSubmit =
    isValidPassword(newPassword) && confirmPassword.length > 0 && confirmPassword === newPassword;

  // GL-327 wires this to authApi.resetPassword, maps the token/strength
  // refusals onto this screen, and routes to Login with a confirmation on
  // success - none of that can happen until that method exists.
  const handleSubmit = () => {};

  return (
    <AuthShell
      scroll
      header={
        <>
          <Brand />
          <Text className="mt-8 font-display text-h1 text-paper">Set a new password</Text>
        </>
      }
    >
      <View className="rounded-ds-md bg-signal-soft px-[14px] py-[11px]">
        <Text className="text-[12.5px] font-semibold text-signal-ink">
          {email ? `Resetting the password for ${email}` : 'Resetting your password'}
        </Text>
      </View>

      <TextInput
        label="New password"
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        containerClassName="mb-1 mt-5"
      />
      <PasswordStrengthMeter password={newPassword} />

      <TextInput
        label="Confirm new password"
        placeholder="Confirm new password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <Notice>Setting a new password signs you out on every device.</Notice>

      <View className="flex-1" />

      <Button fullWidth trailingArrow onPress={handleSubmit} disabled={!canSubmit}>
        Reset password
      </Button>
    </AuthShell>
  );
}
