import { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import applicationApi from '../../api/applicationApi';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import EntryCard from '../../components/profile/EntryCard';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import useHeroScroll from '../../hooks/useHeroScroll';
import { APPLICATION_STATUSES, REJECTION_REASONS } from '../../constants/enums';
import { formatDateRange, formatShortDate } from '../../utils/format';

const LOAD_ERROR_MESSAGE = 'Could not load this applicant. Check your connection and try again.';

function statusLabel(value) {
  return APPLICATION_STATUSES.find((entry) => entry.value === value)?.label ?? value;
}

function reasonLabel(code) {
  return REJECTION_REASONS.find((entry) => entry.value === code)?.label ?? code;
}

// Same format as ApplicantRow.js's row - duplicated rather than shared, the
// rule GL-118 and GL-121 followed for the two gig cards.
function formatRating(rating) {
  const { averageRating = 0, reviewCount = 0 } = rating ?? {};
  if (reviewCount === 0) return 'No ratings yet';
  return `★ ${averageRating.toFixed(1)} (${reviewCount})`;
}

// Pushed from a row on ApplicantsScreen. Opening this also sets Viewed and
// shows the notice saying so - that transition and its UI is GL-259, fired
// on top of the fetch this screen already does. The pinned Reject/Hire bar
// the mockup frame draws is GL-221's ("...from applicant detail"), not built
// here.
export default function ApplicantDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { applicationId } = params;
  const hero = useHeroScroll();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    applicationApi
      .getApplication(applicationId)
      .then((data) => {
        if (!cancelled) setApplication(data.application);
      })
      .catch(() => {
        if (!cancelled) setError(LOAD_ERROR_MESSAGE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const handleBack = () => navigation.goBack();

  if (loading) {
    return <Loader fullScreen />;
  }

  if (error || !application) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Applicant" small onBack={handleBack} />
        <EmptyState
          message={error ?? LOAD_ERROR_MESSAGE}
          actionLabel="Go back"
          onAction={handleBack}
        />
      </SafeAreaView>
    );
  }

  const { profileSnapshot, status, appliedAt, rejectionReasonCode, rejectionNote } = application;
  const isRejected = status === 'rejected';
  const experience = profileSnapshot?.experience ?? [];
  const education = profileSnapshot?.education ?? [];

  return (
    <View className="flex-1 bg-ink">
      <Animated.ScrollView
        onScroll={hero.onScroll}
        scrollEventThrottle={hero.scrollEventThrottle}
        contentContainerClassName="grow"
      >
        <View onLayout={hero.onHeroLayout}>
          <HeroHeader onBack={handleBack}>
            <Avatar name={profileSnapshot?.name} size="lg" className="self-center" />
            <Text className="mt-3 text-center font-display text-[22px] tracking-[-0.025em] text-paper">
              {profileSnapshot?.name}
            </Text>
            <View className="mt-3 flex-row items-center justify-center gap-[9px]">
              <View className="rounded-full border border-white/[0.14] bg-white/10 px-2.5 py-1">
                <Text className="text-[11px] font-semibold text-paper">{statusLabel(status)}</Text>
              </View>
              <Text className="text-[13.5px] font-medium text-muted-dark">
                {formatRating(profileSnapshot?.rating)}
              </Text>
            </View>
          </HeroHeader>
        </View>

        <HeroSheet className="px-[22px] pb-8 pt-[22px]">
          {isRejected ? (
            <View className="mb-5">
              <SectionLabel>Reason given</SectionLabel>
              <Text className="mt-2 font-display text-title text-ink">
                {reasonLabel(rejectionReasonCode)}
              </Text>
              {rejectionNote ? (
                <Text className="mt-2 text-desc leading-[21px] text-muted">{rejectionNote}</Text>
              ) : null}
            </View>
          ) : null}

          <SectionLabel>Profile snapshot</SectionLabel>
          <View className="mt-[10px] gap-[10px]">
            {experience.map((entry, index) => (
              <EntryCard
                key={`experience-${index}`}
                title={entry.roleTitle}
                subtitle={entry.employer}
                dateRange={formatDateRange(entry)}
                description={entry.description}
              />
            ))}
            {education.map((entry, index) => (
              <EntryCard
                key={`education-${index}`}
                title={entry.qualification}
                subtitle={entry.institution}
                dateRange={formatDateRange(entry)}
              />
            ))}
          </View>

          <Text className="mt-3 text-[12px] leading-[16.8px] text-muted-dark">
            Frozen as it stood when they applied on {formatShortDate(new Date(appliedAt))}. Later
            profile edits don&apos;t change this.
          </Text>
        </HeroSheet>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={hero.stickyPointerEvents}
        style={hero.stickyStyle}
        className="absolute left-0 right-0 top-0"
      >
        <SafeAreaView edges={['top']} className="bg-paper">
          <HeroStickyBar title={profileSnapshot?.name ?? 'Applicant'} onBack={handleBack} visible />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
