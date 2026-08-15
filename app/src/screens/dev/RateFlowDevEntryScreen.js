// TEMPORARY — GL-206. There's no real entry point into the rating flow
// until Sprint 2's completed-gigs screen; this exists only so both
// directions and the three refusal paths can be exercised by hand against
// the hire GL-194 seeds, applications applied to manually, and other
// accounts. __DEV__-gated in RootNavigator and must not merge.

import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import Button from '../../components/ui/Button';
import ScreenHeader from '../../components/ui/ScreenHeader';
import TextInput from '../../components/ui/TextInput';

export default function RateFlowDevEntryScreen() {
  const navigation = useNavigation();
  const [applicationId, setApplicationId] = useState('');

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Rate flow (dev)" small onBack={() => navigation.goBack()} />
      <View className="flex-1 px-[22px]">
        <TextInput
          label="Application id"
          placeholder="Paste an application _id"
          autoCapitalize="none"
          autoCorrect={false}
          value={applicationId}
          onChangeText={setApplicationId}
        />
        <Button
          disabled={!applicationId.trim()}
          onPress={() => navigation.navigate('RateFlow', { applicationId: applicationId.trim() })}
        >
          Open rate flow
        </Button>
      </View>
    </SafeAreaView>
  );
}
