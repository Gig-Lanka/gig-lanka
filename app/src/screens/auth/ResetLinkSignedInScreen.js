import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';

// GL-396 AC6: a password-reset link opened while signed in has nowhere to
// land, because ResetPassword is registered only in the signed-out AuthStack.
// This tells the user why, rather than dropping the link. It never signs
// anyone out - a reset signs out every session, so that stays their call.
// Registered in AppStack and AdminStack, so it covers every signed-in role.
export default function ResetLinkSignedInScreen() {
  const navigation = useNavigation();

  return (
    <AuthShell
      header={
        <>
          <Brand />
          <Text className="mt-8 font-display text-h1 text-paper">Reset link</Text>
        </>
      }
    >
      <Notice>You&apos;re signed in. Sign out first to use this reset link.</Notice>

      <View className="flex-1" />

      <Button onPress={() => navigation.goBack()} className="mb-6">
        Back to the app
      </Button>
    </AuthShell>
  );
}
