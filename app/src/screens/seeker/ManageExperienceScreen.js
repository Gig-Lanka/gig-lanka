import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { profileApi } from '../../api';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import EntryCard from '../../components/profile/EntryCard';
import { formatDateRange } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

// Fields other than workExperience that PUT /api/profiles/me still needs -
// left out of the body, a PUT clears them rather than preserving them
// (docs/api-contract.md §8.4). Fetched alongside the list so a delete from
// this screen can PUT the full profile without a second round trip.
const PASSTHROUGH_FIELDS = ['name', 'photo', 'bio', 'city', 'skills', 'education'];

// Newest-first by start date - entries with no start date (rare, since the
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

  const [passthrough, setPassthrough] = useState({});
  const [workExperience, setWorkExperience] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Refetches on every focus - this is what makes an entry added or edited
  // on ExperienceFormScreen show up here on return, matching the pattern
  // ProfileScreen and EditProfileScreen already use.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProfile() {
        try {
          const data = await profileApi.getMyProfile();
          if (!cancelled) {
            setPassthrough(
              Object.fromEntries(PASSTHROUGH_FIELDS.map((field) => [field, data[field]])),
            );
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

  async function handleConfirmDelete() {
    if (deleting || !pendingDelete) return;
    setDeleting(true);
    setDeleteError('');

    // Built from `workExperience` as it stands right now, not a copy from
    // when the screen mounted - so deleting a second entry right after this
    // one can't resurrect the one just removed.
    const nextWorkExperience = workExperience.filter((entry) => entry._id !== pendingDelete._id);

    try {
      const updatedProfile = await profileApi.updateMyProfile({
        ...passthrough,
        workExperience: nextWorkExperience,
      });
      setWorkExperience(updatedProfile.workExperience ?? []);
      setPendingDelete(null);
    } catch (error) {
      const apiError = error.response?.data?.error;
      setDeleteError(apiError?.message || 'Could not delete this entry. Try again.');
    } finally {
      setDeleting(false);
    }
  }

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

      {entries.length === 0 ? (
        <EmptyState
          className="bg-paper"
          message="You haven't added any work experience yet."
          actionLabel="+ Add experience"
          onAction={() => navigation.navigate('ExperienceForm')}
        />
      ) : (
        <>
          <ScrollView className="flex-1" contentContainerClassName="px-[22px] pb-6">
            <Text className="mb-3 text-[11.5px] text-muted-dark">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · newest first
            </Text>

            <View className="gap-[10px]">
              {entries.map((entry) => (
                <EntryCard
                  key={entry._id}
                  title={entry.roleTitle}
                  subtitle={entry.employer}
                  dateRange={formatDateRange(entry)}
                  description={entry.description}
                  onEdit={() => navigation.navigate('ExperienceForm', { entryId: entry._id })}
                  onDelete={() => {
                    setDeleteError('');
                    setPendingDelete(entry);
                  }}
                />
              ))}
            </View>

            {deleteError ? (
              <Text className="mt-3 text-[12.5px] text-danger-ink">{deleteError}</Text>
            ) : null}

            <Notice variant="info" icon="i" className="mt-4">
              No work history yet? A passed Skill Trial counts for more with most businesses.
            </Notice>
          </ScrollView>

          <View className="px-[22px] pb-3 pt-2">
            <Button variant="outline" onPress={() => navigation.navigate('ExperienceForm')}>
              + Add experience
            </Button>
          </View>
        </>
      )}

      <ConfirmDialog
        visible={Boolean(pendingDelete)}
        destructive
        title="Delete this entry?"
        body={
          pendingDelete
            ? `Delete "${pendingDelete.roleTitle}"? This is permanent and cannot be undone.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Keep it"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}
