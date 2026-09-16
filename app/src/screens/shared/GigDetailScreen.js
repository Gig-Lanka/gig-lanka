import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import gigApi from '../../api/gigApi';
import GigBusinessBlock from '../../components/gig/GigBusinessBlock';
import GigDetailList from '../../components/gig/GigDetailList';
import ReportSheet from '../../components/report/ReportSheet';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import useAuth from '../../hooks/useAuth';
import useHeroScroll from '../../hooks/useHeroScroll';
import useSavedToggle from '../../hooks/useSavedToggle';
import {
  COMMITMENT_LENGTHS,
  GIG_CATEGORIES,
  GIG_STATUSES,
  SCHEDULE_TAGS,
  SKILL_TRIAL_EFFORT_ESTIMATES,
  SKILL_TRIAL_REQUIREMENTS,
} from '../../constants/enums';
import { formatDeadline, formatLocation, formatPay, formatShortDate } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error', NOT_FOUND: 'not_found' };

const LOAD_ERROR_MESSAGE = 'Could not load this gig. Check your connection and try again.';

// Same status → Badge variant mapping as BusinessGigCard, kept in sync so a
// gig's status pill reads identically wherever it appears.
const BADGE_VARIANT_BY_STATUS = {
  open: 'positive',
  filled: 'strong',
  closed: 'muted',
  draft: 'neutral',
};

// Ionicons takes a literal color, not a className - mirrors the `signal` /
// `star-off` tokens in tailwind.config.js, same as GigCard's own star.
const SIGNAL_HEX = '#FF4A1C';
const STAR_OFF_HEX = '#C6C7CF';

function labelFor(list, value) {
  return list.find((entry) => entry.value === value)?.label ?? value;
}

// GL-246: primary-action copy for a seeker who already has an application
// against this gig, keyed by status. Applied, viewed and shortlisted share
// one label - none of them carry news yet, so there's nothing to
// distinguish. Hired and completed each read as their own milestone.
// Rejected still just offers to view the application: the reason and note
// are GL-124's to show, verbatim, on the application detail screen - this
// button never turns the decision itself into a headline. Withdrawn is the
// only one that isn't an invitation to view progress - it tells the seeker
// they left and that the permanent (gig, applicant) index means there's no
// applying again.
const ALREADY_APPLIED_LABEL_BY_STATUS = {
  applied: 'View your application',
  viewed: 'View your application',
  shortlisted: 'View your application',
  hired: "You're hired — view application",
  completed: 'Gig complete — view application',
  rejected: 'View your application',
  withdrawn: "You withdrew — you can't apply to this gig again",
};

// A separate component, not inline in GigDetailScreen, so useSavedToggle's
// own first-mount lazy init captures the real `initialSaved` value: this
// only mounts once `gig` has actually loaded (it's built from state that's
// still null during STATUS.LOADING), unlike GigDetailScreen itself, which
// stays mounted across that transition and would otherwise lock the hook's
// initial state to the pre-load "false".
function GigDetailSaveStar({ gigId, initialSaved, onConflict }) {
  const { saved, toggle, conflictMessage } = useSavedToggle(gigId, initialSaved);

  useEffect(() => {
    onConflict?.(conflictMessage);
  }, [conflictMessage, onConflict]);

  return (
    <Pressable
      onPress={toggle}
      hitSlop={10}
      className="h-[34px] w-[34px] items-center justify-center"
    >
      <Ionicons
        name={saved ? 'star' : 'star-outline'}
        size={24}
        color={saved ? SIGNAL_HEX : STAR_OFF_HEX}
      />
    </Pressable>
  );
}

export default function GigDetailScreen({ onSignIn }) {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { gigId } = params;
  const hero = useHeroScroll();
  const { user } = useAuth();

  const [gig, setGig] = useState(null);
  const [business, setBusiness] = useState(null);
  const [viewerApplication, setViewerApplication] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [saveConflictMessage, setSaveConflictMessage] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [reportSheetKey, setReportSheetKey] = useState(0);

  // Refetches on every focus, not just on mount - same rationale as the
  // profile screens (GL-145's edit screen calls goBack() rather than
  // passing data back), and it doubles as the retry mechanism: bumping
  // reloadToken changes this callback's identity, which is what makes
  // useFocusEffect run it again while the screen is already focused.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadGig() {
        try {
          const data = await gigApi.getGig(gigId);
          if (!cancelled) {
            setGig(data.gig);
            setBusiness(data.business);
            setViewerApplication(data.viewerApplication ?? null);
            setStatus(STATUS.READY);
          }
        } catch (error) {
          if (cancelled) return;
          const isNotFound =
            error.response?.status === 404 || error.response?.data?.error?.code === 'NOT_FOUND';
          setStatus(isNotFound ? STATUS.NOT_FOUND : STATUS.ERROR);
        }
      }

      loadGig();

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
        <ScreenHeader title="Gig" small onBack={handleBack} />
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
        <ScreenHeader title="Gig" small onBack={handleBack} />
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
    title,
    payAmount,
    payType,
    status: gigStatus,
    city,
    area,
    remote,
    category,
    schedule = [],
    commitment,
    positions,
    startDate,
    applicationsCloseDate,
    applicantCount = 0,
    createdAt,
    description,
    skillTrial,
  } = gig;

  // GL-356 - brief §4: the effort estimate is shown before the seeker opens
  // the task, not only on Apply, so nobody discovers the size of the task
  // after committing to it. `requirement` is only ever `none` or `optional`
  // (GL-341 removed `required` from the vocabulary - see
  // docs/api-contract.md §6.12), so the badge below reads its label from the
  // real list rather than hardcoding "Required".
  const hasSkillTrial = Boolean(skillTrial) && skillTrial.requirement !== 'none';

  const location = formatLocation({ isRemote: remote, area, city });
  const isOpen = gigStatus === 'open';
  // GL-283: while open, the banner shows the date-derived urgency copy; once
  // closed - for any reason, including a deadline that's since passed - it
  // shows the same status-derived copy as the badge and the primary action
  // below, so the two can never disagree again.
  const deadline = isOpen
    ? applicationsCloseDate
      ? formatDeadline(applicationsCloseDate)
      : null
    : { label: 'Applications closed', urgent: false };

  // GL-155's public profile screen may not be registered yet - routing into
  // it unconditionally would throw on tap ("was not handled by any
  // navigator"). Checking the enclosing stack's own route names is what
  // keeps the block inert until that screen actually exists, with nothing
  // else here needing to change once it does.
  const canViewBusinessProfile = navigation.getState().routeNames.includes('PublicProfile');
  const handleViewBusiness = canViewBusinessProfile
    ? () => navigation.navigate('PublicProfile', { userId: business.id })
    : undefined;

  // Five states, checked in this order because each overrides the ones
  // below it - an owner sees their edit route no matter the gig's status,
  // and a closed gig reads the same to a guest as to a seeker:
  //  1. The owning business - apply is never offered, editing is.
  //  2. GL-246: a seeker who already has an application against this gig -
  //     status-dependent copy, always routing to the application, never
  //     offering Apply again. Deliberately above "not open": a seeker whose
  //     gig has since closed still needs a route to their application, not
  //     "Applications closed".
  //  3. Any other viewer, gig not open - "Applications closed", disabled,
  //     never hidden.
  //  4. A guest, gig open - routes to sign-in; reading is public, applying
  //     is not.
  //  5. A signed-in seeker, gig open, no application yet - routes to
  //     GL-123's apply screen.
  // Display-only: the server is what actually enforces who may apply -
  // viewerApplication itself is server-derived (GL-245), never inferred here.
  const isOwner = user?.role === 'business' && business?.id === user?.id;
  const isSeeker = user?.role === 'seeker';

  // GL-381: a guest sees no Report action at all - reporting is not
  // something to nudge an anonymous visitor into, and this screen already
  // knows guest state from `user` rather than needing a routeNames lookup.
  // A business reporting its own gig makes no sense either.
  const canReport = Boolean(user) && !isOwner;

  let primaryAction = null;
  if (isOwner) {
    primaryAction = {
      label: 'Edit this gig',
      onPress: () => navigation.navigate('EditGig', { gigId }),
    };
  } else if (viewerApplication) {
    primaryAction = {
      label: ALREADY_APPLIED_LABEL_BY_STATUS[viewerApplication.status] ?? 'View your application',
      onPress: () =>
        navigation.navigate('ApplicationDetail', { applicationId: viewerApplication.id }),
    };
  } else if (!isOpen) {
    primaryAction = { label: 'Applications closed', disabled: true };
  } else if (!user) {
    primaryAction = { label: 'Apply for this gig', onPress: () => onSignIn?.(gigId) };
  } else if (isSeeker) {
    primaryAction = {
      label: 'Apply for this gig',
      onPress: () => navigation.navigate('Apply', { gigId }),
    };
  }

  const detailRows = [
    { label: 'Category', value: labelFor(GIG_CATEGORIES, category) },
    { label: 'Schedule', value: schedule.map((tag) => labelFor(SCHEDULE_TAGS, tag)).join(', ') },
    { label: 'Commitment', value: labelFor(COMMITMENT_LENGTHS, commitment) },
    { label: 'Location', value: location },
    { label: 'Starts', value: startDate ? formatShortDate(new Date(startDate)) : null },
    { label: 'Positions', value: String(positions) },
    { label: 'Applicants so far', value: String(applicantCount) },
  ];

  return (
    <View className="flex-1 bg-ink">
      <Animated.ScrollView
        className="flex-1"
        onScroll={hero.onScroll}
        scrollEventThrottle={hero.scrollEventThrottle}
        contentContainerClassName="grow"
      >
        <View onLayout={hero.onHeroLayout}>
          <HeroHeader
            onBack={handleBack}
            rightSlot={
              isSeeker ? (
                <GigDetailSaveStar
                  gigId={gigId}
                  initialSaved={gig.viewerSaved}
                  onConflict={setSaveConflictMessage}
                />
              ) : undefined
            }
          >
            <Text className="font-display text-[25px] leading-[29px] tracking-[-0.025em] text-paper">
              {title}
            </Text>
            <View className="mt-3 flex-row items-center gap-[11px]">
              <Text className="font-display text-[24px] tracking-[-0.03em] text-signal">
                {formatPay(payAmount, payType)}
              </Text>
              <Badge variant={BADGE_VARIANT_BY_STATUS[gigStatus] ?? 'neutral'}>
                {labelFor(GIG_STATUSES, gigStatus)}
              </Badge>
            </View>
            <Text className="mt-2 text-[13.5px] font-medium text-muted-dark">
              {location} · {labelFor(COMMITMENT_LENGTHS, commitment)}
            </Text>
          </HeroHeader>
        </View>

        <HeroSheet className="px-[22px] pb-8 pt-[22px]">
          {saveConflictMessage ? (
            <Text className="mb-4 text-[13.5px] font-medium text-danger-ink">
              {saveConflictMessage}
            </Text>
          ) : null}

          {deadline ? (
            <View
              className={[
                'rounded-ds-md px-[14px] py-[11px]',
                deadline.urgent ? 'bg-warning-soft' : 'bg-haze',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-[13.5px] font-medium',
                  deadline.urgent ? 'text-warning-ink' : 'text-muted',
                ].join(' ')}
              >
                {deadline.label}
              </Text>
            </View>
          ) : null}

          <GigBusinessBlock
            business={business}
            postedAt={createdAt}
            onPress={handleViewBusiness}
            className={deadline || saveConflictMessage ? 'mt-4' : undefined}
          />

          <View className="mt-5">
            <SectionLabel>About this gig</SectionLabel>
            <Text className="mt-2 text-desc leading-[21px] text-muted">{description}</Text>
          </View>

          {hasSkillTrial ? (
            <View className="mt-5">
              <SectionLabel>Skill trial</SectionLabel>
              <View className="mt-2 flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-[13.5px] font-semibold text-ink" numberOfLines={1}>
                  {skillTrial.taskTitle}
                </Text>
                <View className="flex-row items-center gap-[6px]">
                  <Badge variant="strong">
                    {labelFor(SKILL_TRIAL_REQUIREMENTS, skillTrial.requirement)}
                  </Badge>
                  <Badge variant="neutral">
                    {labelFor(SKILL_TRIAL_EFFORT_ESTIMATES, skillTrial.effortEstimate)}
                  </Badge>
                </View>
              </View>
            </View>
          ) : null}

          <View className="mt-5">
            <SectionLabel>Details</SectionLabel>
            <GigDetailList rows={detailRows} className="mt-2" />
          </View>

          {canReport ? (
            <Pressable
              onPress={() => {
                setReportSheetKey((key) => key + 1);
                setReportSheetVisible(true);
              }}
              className="mt-5 items-center py-2"
            >
              <Text className="text-[12.5px] font-semibold text-muted">Report this gig</Text>
            </Pressable>
          ) : null}
        </HeroSheet>
      </Animated.ScrollView>

      {primaryAction ? (
        <SafeAreaView
          edges={['bottom']}
          className="border-t border-line bg-paper px-[22px] pb-[10px] pt-[14px]"
        >
          <Button
            disabled={primaryAction.disabled}
            trailingArrow={!primaryAction.disabled}
            onPress={primaryAction.onPress}
          >
            {primaryAction.label}
          </Button>
        </SafeAreaView>
      ) : null}

      <Animated.View
        pointerEvents={hero.stickyPointerEvents}
        style={hero.stickyStyle}
        className="absolute left-0 right-0 top-0"
      >
        <SafeAreaView edges={['top']} className="bg-paper">
          <HeroStickyBar title={title} onBack={handleBack} visible />
        </SafeAreaView>
      </Animated.View>

      {canReport ? (
        <ReportSheet
          key={reportSheetKey}
          visible={reportSheetVisible}
          targetType="gig"
          targetName={title}
          // GL-381 covers the entry point only - submitting to the report
          // API and the success/duplicate Notice land with reportApi.js in
          // a later subtask. For now this just closes the sheet.
          onConfirm={() => setReportSheetVisible(false)}
          onCancel={() => setReportSheetVisible(false)}
        />
      ) : null}
    </View>
  );
}
