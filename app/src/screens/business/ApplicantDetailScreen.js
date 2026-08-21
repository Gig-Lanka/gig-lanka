import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import applicationApi from '../../api/applicationApi';
import ApplicantActionRow, {
  applicantActionsForStatus,
} from '../../components/application/ApplicantActionRow';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import EntryCard from '../../components/profile/EntryCard';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import HireConfirmSheet from '../../components/application/HireConfirmSheet';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import RejectReasonSheet from '../../components/application/RejectReasonSheet';
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

const SHORTLIST_ERROR_MESSAGE = 'Could not shortlist this applicant. Try again.';
const REJECT_ERROR_MESSAGE = 'Could not reject this applicant. Try again.';
const HIRE_ERROR_MESSAGE = 'Could not hire this applicant. Try again.';
const COMPLETE_ERROR_MESSAGE = 'Could not mark this application complete. Try again.';

// GL-221 §14: the seeker can withdraw at any moment, including while one of
// these sheets is open, so a 409 here is a real race, not a theoretical one
// - it must read as "someone else already decided this," not a generic
// failure. Same wording as ApplicationDetailScreen's withdraw 409, the
// seeker-side precedent this mirrors, parameterised per action rather than
// four near-identical strings.
function conflictMessage(action) {
  return `This application's status has already changed, so it can no longer be ${action}.`;
}

// Pushed from a row on ApplicantsScreen. GL-260 built the pinned action row
// and wired Shortlist; GL-261 wired Reject to RejectReasonSheet. This wires
// Hire and Mark complete to GL-262's HireConfirmSheet.
export default function ApplicantDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { applicationId } = params;
  const hero = useHeroScroll();

  const [application, setApplication] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectInstance, setRejectInstance] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState(null);
  const [rejectFieldErrors, setRejectFieldErrors] = useState({});
  const [hireVisible, setHireVisible] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [hireError, setHireError] = useState(null);
  const [completeVisible, setCompleteVisible] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);
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

  // Updates `application` in place from the response rather than
  // refetching, so the hero pill and the action row re-render to
  // `shortlisted` immediately (GL-221 §2, §13) - ApplicantsScreen picks up
  // the same change on its own next focus (GL-257's refetch-on-focus).
  async function handleShortlist() {
    if (pendingAction) return;
    setActionError(null);
    setPendingAction('shortlist');
    try {
      const { application: updated } = await applicationApi.shortlistApplication(application.id);
      setApplication(updated);
    } catch (error) {
      setActionError(
        error.response?.status === 409
          ? conflictMessage('shortlisted')
          : error.response?.data?.error?.message || SHORTLIST_ERROR_MESSAGE,
      );
    } finally {
      setPendingAction(null);
    }
  }

  function handleReject() {
    if (pendingAction) return;
    setRejectError(null);
    setRejectFieldErrors({});
    setRejectInstance((value) => value + 1);
    setRejectVisible(true);
  }

  function handleCancelReject() {
    if (rejecting) return;
    setRejectVisible(false);
  }

  // Same in-place update as handleShortlist - the hero pill and the action
  // row re-render to `rejected` (no actions left) as soon as this resolves.
  // §15: a 400 from the four rejection rules (§11.4) always names
  // `reasonCode` (assertValidRejection never inspects `note`), so it's
  // routed to the sheet's field errors instead of the generic banner -
  // same `errors[]` -> `{ field: message }` shape PostGigScreen already
  // builds from its own VALIDATION_ERROR responses.
  async function handleConfirmReject({ reasonCode, note }) {
    setRejecting(true);
    setPendingAction('reject');
    setRejectError(null);
    setRejectFieldErrors({});
    try {
      const { application: updated } = await applicationApi.rejectApplication(application.id, {
        reasonCode,
        note,
      });
      setApplication(updated);
      setRejectVisible(false);
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        apiError.errors.forEach((entry) => {
          fieldErrors[entry.field] = entry.message;
        });
        setRejectFieldErrors(fieldErrors);
      } else {
        setRejectError(
          error.response?.status === 409
            ? conflictMessage('rejected')
            : apiError?.message || REJECT_ERROR_MESSAGE,
        );
      }
    } finally {
      setRejecting(false);
      setPendingAction(null);
    }
  }

  function handleHire() {
    if (pendingAction) return;
    setHireError(null);
    setHireVisible(true);
  }

  function handleCancelHire() {
    if (hiring) return;
    setHireVisible(false);
  }

  // Same in-place update as handleShortlist/handleConfirmReject - the hero
  // pill and the action row re-render to `hired` (Mark complete only) as
  // soon as this resolves.
  async function handleConfirmHire() {
    setHiring(true);
    setPendingAction('hire');
    setHireError(null);
    try {
      const { application: updated } = await applicationApi.hireApplication(application.id);
      setApplication(updated);
      setHireVisible(false);
    } catch (error) {
      setHireError(
        error.response?.status === 409
          ? conflictMessage('hired')
          : error.response?.data?.error?.message || HIRE_ERROR_MESSAGE,
      );
    } finally {
      setHiring(false);
      setPendingAction(null);
    }
  }

  function handleMarkComplete() {
    if (pendingAction) return;
    setCompleteError(null);
    setCompleteVisible(true);
  }

  function handleCancelComplete() {
    if (completing) return;
    setCompleteVisible(false);
  }

  async function handleConfirmComplete() {
    setCompleting(true);
    setPendingAction('complete');
    setCompleteError(null);
    try {
      const { application: updated } = await applicationApi.completeApplication(application.id);
      setApplication(updated);
      setCompleteVisible(false);
    } catch (error) {
      setCompleteError(
        error.response?.status === 409
          ? conflictMessage('marked complete')
          : error.response?.data?.error?.message || COMPLETE_ERROR_MESSAGE,
      );
    } finally {
      setCompleting(false);
      setPendingAction(null);
    }
  }

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
  const hasActions = applicantActionsForStatus(applicationStatus).length > 0;

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

        <HeroSheet className={['px-[22px] pt-[22px]', hasActions ? 'pb-32' : 'pb-8'].join(' ')}>
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

      {hasActions ? (
        <SafeAreaView edges={['bottom']} className="border-t border-line bg-paper">
          <View className="px-[22px] pb-3 pt-3">
            <ApplicantActionRow
              status={applicationStatus}
              pendingAction={pendingAction}
              onShortlist={handleShortlist}
              onReject={handleReject}
              onHire={handleHire}
              onComplete={handleMarkComplete}
            />
            {actionError ? (
              <Text className="mt-2 text-[12.5px] text-danger-ink">{actionError}</Text>
            ) : null}
          </View>
        </SafeAreaView>
      ) : null}

      <RejectReasonSheet
        key={rejectInstance}
        visible={rejectVisible}
        applicantName={profileSnapshot?.name}
        submitting={rejecting}
        error={rejectError}
        errors={rejectFieldErrors}
        onConfirm={handleConfirmReject}
        onCancel={handleCancelReject}
      />

      <HireConfirmSheet
        visible={hireVisible}
        title={`Hire ${profileSnapshot?.name}?`}
        body="This confirms hiring them for this gig."
        confirmLabel="Hire"
        submitting={hiring}
        error={hireError}
        onConfirm={handleConfirmHire}
        onCancel={handleCancelHire}
      />

      <HireConfirmSheet
        visible={completeVisible}
        title="Mark this hire complete?"
        body="This unlocks rating for both sides and can't be undone."
        confirmLabel="Mark complete"
        submitting={completing}
        error={completeError}
        onConfirm={handleConfirmComplete}
        onCancel={handleCancelComplete}
      />
    </View>
  );
}
