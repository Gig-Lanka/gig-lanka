import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { authApi } from '../../api';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import useAuth from '../../hooks/useAuth';
import { formatShortDate } from '../../utils/format';

const ROLE_LABELS = {
  seeker: 'Job Seeker',
  business: 'Business',
};

function Divider() {
  return <View className="h-px bg-line" />;
}

function FactRow({ label, value, trailing }) {
  return (
    <View className="flex-row items-center justify-between py-[14px]">
      <View>
        <Text className="text-[12.5px] font-semibold text-muted">{label}</Text>
        <Text className="mt-[2px] text-[14.5px] font-semibold text-ink">{value}</Text>
      </View>
      {trailing ? <Text className="text-[11.5px] text-muted-dark">{trailing}</Text> : null}
    </View>
  );
}

function NavRow({ label, onPress }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between py-[14px]">
      <Text className="text-[14.5px] font-semibold text-ink">{label}</Text>
      <Text className="text-[17px] font-semibold text-muted-dark">›</Text>
    </Pressable>
  );
}

export default function AccountSettingsScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const isSeeker = user?.role === 'seeker';

  // AuthContext's user already carries createdAt from login/register/bootstrap
  // (docs/api-contract.md §5.1-5.2, §5.5), so this only round-trips to
  // /auth/me for a context copy that predates that field.
  const [fetchedCreatedAt, setFetchedCreatedAt] = useState(null);
  const createdAt = user?.createdAt ?? fetchedCreatedAt;

  useEffect(() => {
    if (user?.createdAt) return undefined;

    let cancelled = false;
    authApi.getCurrentUser().then((result) => {
      if (!cancelled) setFetchedCreatedAt(result.user.createdAt);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Account" small onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1" contentContainerClassName="px-[22px] pb-6">
        <SectionLabel>Account details</SectionLabel>
        <View className="mt-2">
          <FactRow label="Email" value={user?.email} />
          <Divider />
          <FactRow label="Role" value={ROLE_LABELS[user?.role]} trailing="Permanent" />
          <Divider />
          <FactRow
            label="Member since"
            value={createdAt ? formatShortDate(new Date(createdAt)) : ''}
          />
        </View>

        <SectionLabel className="mt-6">Security</SectionLabel>
        <View className="mt-2">
          <NavRow
            label="Change password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <Divider />
          <NavRow label="Log out" onPress={logout} />
        </View>

        <SectionLabel className="mt-6">Profile</SectionLabel>
        <View className="mt-2">
          <NavRow label="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
          {isSeeker ? (
            <>
              <Divider />
              <NavRow
                label="Work experience"
                onPress={() => navigation.navigate('ManageExperience')}
              />
              <Divider />
              <NavRow label="Education" onPress={() => navigation.navigate('ManageEducation')} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
