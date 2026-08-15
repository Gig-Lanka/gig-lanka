import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import gigApi from '../../api/gigApi';
import { profileApi } from '../../api';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import EntryCard from '../../components/profile/EntryCard';
import ProfileEmptyRow from '../../components/profile/ProfileEmptyRow';
import SkillsRow from '../../components/profile/SkillsRow';
import { formatDateRange, formatDeadline, formatPay } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error', NOT_FOUND: 'not_found' };

const LOAD_ERROR_MESSAGE = 'Could not load this screen. Check your connection and try again.';

// Same signal the server recomputes at submission time (§11.7's
// `profileIncomplete`) — a profile with neither is thin, and the seeker is
// warned before sending, not after. This never blocks the apply action.
function isThinProfile(profile) {
  return (profile.workExperience?.length ?? 0) === 0 && (profile.education?.length ?? 0) === 0;
}

export default function ApplyScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { gigId } = params;

  const [gig, setGig] = useState(null);
  const [business, setBusiness] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  // Same refetch-on-focus pattern as GigDetailScreen/ProfileScreen — bumping
  // reloadToken changes this callback's identity, which is what makes
  // useFocusEffect run it again for the Retry button.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadApplyData() {
        try {
          const [gigData, profileData] = await Promise.all([
            gigApi.getGig(gigId),
            profileApi.getMyProfile(),
          ]);
          if (cancelled) return;
          setGig(gigData.gig);
          setBusiness(gigData.business);
          setProfile(profileData);
          setStatus(STATUS.READY);
        } catch (error) {
          if (cancelled) return;
          const isNotFound =
            error.response?.status === 404 || error.response?.data?.error?.code === 'NOT_FOUND';
          setStatus(isNotFound ? STATUS.NOT_FOUND : STATUS.ERROR);
        }
      }

      loadApplyData();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gigId, reloadToken]),
  );

  const handleBack = () => navigation.goBack();

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.NOT_FOUND) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Apply" small onBack={handleBack} />
        <EmptyState
          message="This gig no longer exists."
          actionLabel="Go back"
          onAction={handleBack}
        />
      </SafeAreaView>
    );
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Apply" small onBack={handleBack} />
        <EmptyState
          message={LOAD_ERROR_MESSAGE}
          actionLabel="Retry"
          onAction={() => {
            setStatus(STATUS.LOADING);
            setReloadToken((token) => token + 1);
          }}
        />
      </SafeAreaView>
    );
  }

  const { title, payAmount, payType, applicationsCloseDate } = gig;
  const { name, photo, skills = [], workExperience = [], education = [] } = profile;
  const deadline = applicationsCloseDate ? formatDeadline(applicationsCloseDate) : null;
  const thinProfile = isThinProfile(profile);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Apply" small onBack={handleBack} />

      <ScrollView contentContainerClassName="px-[22px] pb-8" showsVerticalScrollIndicator={false}>
        <View className="rounded-ds-card border-[1.5px] border-line bg-paper p-4">
          <Text className="font-display text-title text-ink">{title}</Text>
          <Text className="mt-[5px] text-desc text-muted" numberOfLines={1}>
            {business?.name}
          </Text>
          <View className="mt-3 flex-row items-center gap-[11px]">
            <Text className="font-display text-[19px] tracking-[-0.02em] text-signal">
              {formatPay(payAmount, payType)}
            </Text>
            {deadline ? (
              <Text
                className={[
                  'text-[12.5px] font-semibold',
                  deadline.urgent ? 'text-warning-ink' : 'text-muted-dark',
                ].join(' ')}
              >
                {deadline.label}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="mt-6">
          <SectionLabel>{`What ${business?.name ?? 'the business'} will see`}</SectionLabel>

          <View className="mt-2 rounded-ds-card border-[1.5px] border-line bg-paper p-4">
            <View className="flex-row items-center gap-[13px]">
              <Avatar uri={photo} name={name} size="md" />
              <Text className="flex-1 font-display text-title text-ink" numberOfLines={1}>
                {name}
              </Text>
            </View>

            {skills.length > 0 ? <SkillsRow skills={skills} className="mt-4" /> : null}

            {workExperience.length > 0 ? (
              <View className="mt-4 gap-[10px]">
                <SectionLabel>Work experience</SectionLabel>
                {workExperience.map((entry) => (
                  <EntryCard
                    key={entry._id}
                    title={entry.roleTitle}
                    subtitle={entry.employer}
                    dateRange={formatDateRange(entry)}
                  />
                ))}
              </View>
            ) : null}

            {education.length > 0 ? (
              <View className="mt-4 gap-[10px]">
                <SectionLabel>Education</SectionLabel>
                {education.map((entry) => (
                  <EntryCard
                    key={entry._id}
                    title={entry.qualification}
                    subtitle={entry.institution}
                    dateRange={formatDateRange(entry)}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <Notice className="mt-3">
            This is a snapshot of your profile as it stands right now. If you edit your profile
            later, it won&apos;t change what you&apos;ve applied with.
          </Notice>

          {thinProfile ? (
            <ProfileEmptyRow
              className="mt-3"
              message="Your profile has no work experience or education yet. Adding some gives the business more to go on — you can still apply without it."
              actionLabel="Update your profile"
              onAction={() => navigation.navigate('Main', { screen: 'Profile' })}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
