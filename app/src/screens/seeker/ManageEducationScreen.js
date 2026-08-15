import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { profileApi } from '../../api';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import EntryCard from '../../components/profile/EntryCard';
import { formatDateRange } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

// Newest-first by start date — same convention as ManageExperienceScreen.
function sortNewestFirst(entries) {
  return [...entries].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return b.startDate.localeCompare(a.startDate);
  });
}

export default function ManageEducationScreen() {
  const navigation = useNavigation();

  const [education, setEducation] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  // Refetches on every focus — this is what makes an entry added or edited
  // on EducationFormScreen show up here on return, matching the pattern
  // ManageExperienceScreen already uses.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProfile() {
        try {
          const data = await profileApi.getMyProfile();
          if (!cancelled) {
            setEducation(data.education ?? []);
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
        message="We couldn't load your education."
        actionLabel="Retry"
        onAction={() => setReloadToken((token) => token + 1)}
      />
    );
  }

  const entries = sortNewestFirst(education);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader
        title="Education"
        small
        onBack={() => navigation.goBack()}
        rightSlot={
          <Pressable onPress={() => navigation.navigate('EducationForm')} hitSlop={8}>
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
              title={entry.qualification}
              subtitle={entry.institution}
              dateRange={formatDateRange(entry)}
              onEdit={() => navigation.navigate('EducationForm', { entryId: entry._id })}
            />
          ))}
        </View>
      </ScrollView>

      <View className="px-[22px] pb-3 pt-2">
        <Button variant="outline" onPress={() => navigation.navigate('EducationForm')}>
          + Add education
        </Button>
      </View>
    </SafeAreaView>
  );
}
