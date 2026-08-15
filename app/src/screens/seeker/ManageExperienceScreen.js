import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { profileApi } from '../../api';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import EntryCard from '../../components/profile/EntryCard';
import { formatDateRange } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

// Newest-first by start date — entries with no start date (rare, since the
// field is only optional to match the server) sort to the end rather than
// jumping to the top.
function sortNewestFirst(entries) {
  return [...entries].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return b.startDate.localeCompare(a.startDate);
  });
}

export default function ManageExperienceScreen() {
  const navigation = useNavigation();

  const [workExperience, setWorkExperience] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  // Refetches on every focus — this is what makes an entry added or edited
  // on ExperienceFormScreen show up here on return, matching the pattern
  // ProfileScreen and EditProfileScreen already use.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProfile() {
        try {
          const data = await profileApi.getMyProfile();
          if (!cancelled) {
            setWorkExperience(data.workExperience ?? []);
            setStatus(STATUS.READY);
          }
        } catch {
          if (!cancelled) setStatus(STATUS.ERROR);
        }
      }

      setStatus(STATUS.LOADING);
      loadProfile();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadToken]),
  );

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.ERROR) {
    return (
      <EmptyState
        className="bg-paper"
        message="We couldn't load your work experience."
        actionLabel="Retry"
        onAction={() => setReloadToken((token) => token + 1)}
      />
    );
  }

  const entries = sortNewestFirst(workExperience);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader
        title="Work experience"
        small
        onBack={() => navigation.goBack()}
        rightSlot={
          <Pressable onPress={() => navigation.navigate('ExperienceForm')} hitSlop={8}>
            <Text className="text-[14px] font-bold text-signal">+ Add</Text>
          </Pressable>
        }
      />

      <ScrollView className="flex-1" contentContainerClassName="px-[22px] pb-6">
        {entries.length > 0 ? (
          <Text className="mb-3 text-[11.5px] text-muted-dark">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · newest first
          </Text>
        ) : null}

        <View className="gap-[10px]">
          {entries.map((entry) => (
            <EntryCard
              key={entry._id}
              title={entry.roleTitle}
              subtitle={entry.employer}
              dateRange={formatDateRange(entry)}
              description={entry.description}
              onEdit={() => navigation.navigate('ExperienceForm', { entryId: entry._id })}
            />
          ))}
        </View>

        <Notice variant="info" icon="i" className="mt-4">
          No work history yet? A passed Skill Trial counts for more with most businesses.
        </Notice>
      </ScrollView>

      <View className="px-[22px] pb-3 pt-2">
        <Button variant="outline" onPress={() => navigation.navigate('ExperienceForm')}>
          + Add experience
        </Button>
      </View>
    </SafeAreaView>
  );
}
