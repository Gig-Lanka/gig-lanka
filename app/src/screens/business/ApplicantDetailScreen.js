import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import applicationApi from '../../api/applicationApi';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import EntryCard from '../../components/profile/EntryCard';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import useHeroScroll from '../../hooks/useHeroScroll';
import { APPLICATION_STATUSES, REJECTION_REASONS } from '../../constants/enums';
import { formatDateRange, formatShortDate } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

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

// Pushed from a row on ApplicantsScreen. The pinned Reject/Hire bar the
// mockup frame draws is GL-221's ("...from applicant detail"), not built
// here.
export default function ApplicantDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { applicationId } = params;
  const hero = useHeroScroll();

  const [application, setApplication] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const hasFiredViewRef = useRef(false);

  // Refetches on every focus, not just mount - same pattern as the seeker's
  // ApplicationDetailScreen/GigDetailScreen - and doubles as the retry
  // mechanism via reloadToken.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadApplication() {
        try {
          const data = await applicationApi.getApplication(applicationId);
          if (!cancelled) {
            setApplication(data.application);
            setStatus(STATUS.READY);
          }
        } catch {
          if (!cancelled) setStatus(STATUS.ERROR);
        }
      }

      loadApplication();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applicationId, reloadToken]),
  );

  // Fires once per mount, not on every focus, and never blocks rendering -
  // the screen already has the application from the fetch above; this PATCH
  // is a side effect of looking at it (GL-220's technical note). A 409 means
  // the application was already past `applied` (§11.3) - not an error, so
  // it's swallowed the same as any other failure here: a business must never
  // be shown a failure for opening something twice.
  useEffect(() => {
    if (hasFiredViewRef.current) return;
    hasFiredViewRef.current = true;
    applicationApi.viewApplication(applicationId).catch(() => {});
  }, [applicationId]);

  const handleBack = () => navigation.goBack();

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Applicant" small onBack={handleBack} />
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

  const {
    profileSnapshot,
    status: applicationStatus,
    appliedAt,
    rejectionReasonCode,
    rejectionNote,
  } = application;
  const isRejected = applicationStatus === 'rejected';
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
                <Text className="text-[11px] font-semibold text-paper">
                  {statusLabel(applicationStatus)}
                </Text>
              </View>
              <Text className="text-[13.5px] font-medium text-muted-dark">
                {formatRating(profileSnapshot?.rating)}
              </Text>
            </View>
          </HeroHeader>
        </View>

        <HeroSheet className="px-[22px] pb-8 pt-[22px]">
          <Notice className="mb-5">
            Opening this marked the application Viewed. The applicant can see that, and it
            can&apos;t be undone.
          </Notice>

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
