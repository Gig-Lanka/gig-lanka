import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';

import applicationApi from '../../api/applicationApi';
import gigApi from '../../api/gigApi';
import { profileApi, uploadApi } from '../../api';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import EntryCard from '../../components/profile/EntryCard';
import ProfileEmptyRow from '../../components/profile/ProfileEmptyRow';
import SkillsRow from '../../components/profile/SkillsRow';
import {
  SKILL_TRIAL_EFFORT_ESTIMATES,
  SKILL_TRIAL_REQUIREMENTS,
  SKILL_TRIAL_RESULTS,
} from '../../constants/enums';
import useAuth from '../../hooks/useAuth';
import { formatDateRange, formatDeadline, formatFileSize, formatPay } from '../../utils/format';
import { validateResumeFile } from '../../utils/validation';

function labelFor(list, value) {
  return list.find((item) => item.value === value)?.label ?? value;
}

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error', NOT_FOUND: 'not_found' };

const LOAD_ERROR_MESSAGE = 'Could not load this screen. Check your connection and try again.';

const BUSINESS_REFUSAL_MESSAGE = 'Only job seekers can apply for gigs.';

// The fallback for anything §11.7 doesn't name a specific message for -
// GIG_CLOSED, APPLICATION_ALREADY_EXISTS and FORBIDDEN are all branched
// explicitly in handleSubmit's catch block below.
const GENERIC_SUBMIT_ERROR =
  'Could not submit your application. Check your connection and try again.';

// GL-363: an upload failure never blocks the application - the seeker can
// still submit without the attachment - so this only ever surfaces inline
// next to the attach row, the same pattern SkillTrialScreen's
// GENERIC_UPLOAD_ERROR uses for its own attachment.
const RESUME_DOCUMENT_PICKER_TYPES = ['application/pdf'];
const GENERIC_RESUME_UPLOAD_ERROR =
  'Could not upload the file. Check your connection and try again.';

// Same signal the server recomputes at submission time (§11.7's
// `profileIncomplete`) - a profile with neither is thin, and the seeker is
// warned before sending, not after. This never blocks the apply action.
function isThinProfile(profile) {
  return (profile.workExperience?.length ?? 0) === 0 && (profile.education?.length ?? 0) === 0;
}

// GL-357 - the wire shape §11.7 accepts is exactly `{ textResponse, fileUrl }`;
// `attachmentName`/`attachmentSize` on the object SkillTrialScreen hands back
// are only for SkillTrialScreen's own locked-reopen re-display and are
// never sent here.
function toSkillTrialSubmissionBody(trialSubmission) {
  if (!trialSubmission) return undefined;
  const { textResponse, fileUrl } = trialSubmission;
  return { textResponse, fileUrl };
}

export default function ApplyScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { gigId, trialSubmission } = params;
  const { user } = useAuth();
  // A guest can never actually mount this screen - it's only registered in
  // the authenticated seeker stack (RootNavigator.js), and GigDetailScreen
  // routes a guest's tap on Apply to sign-in instead of navigating here. The
  // seeker check below is what's actually reachable: a business account
  // hitting this route directly (stale deep link, role changed mid-session).
  const isSeeker = user?.role === 'seeker';

  const [gig, setGig] = useState(null);
  const [business, setBusiness] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  // GL-357 - true only when the server refused the trial content itself
  // (a validation error on skillTrialSubmission), which is the one failure
  // that has to unlock the trial for editing again - every other apply
  // failure leaves it exactly as submitted, per the frame's finality promise.
  const [trialNeedsRevision, setTrialNeedsRevision] = useState(false);
  // GL-363 - { name, size, url } once a resume is attached, or null. Never
  // required: handleSubmit reads `resume?.url` and sends undefined when this
  // is null, which the server (GL-362) stores as no resume at all.
  const [resume, setResume] = useState(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeError, setResumeError] = useState('');

  // Same refetch-on-focus pattern as GigDetailScreen/ProfileScreen - bumping
  // reloadToken changes this callback's identity, which is what makes
  // useFocusEffect run it again for the Retry button. Skipped entirely for
  // a non-seeker: there's nothing to preview and no point spending the
  // request.
  useFocusEffect(
    useCallback(() => {
      if (!isSeeker) return undefined;

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
    }, [gigId, isSeeker, reloadToken]),
  );

  const handleBack = () => navigation.goBack();

  // GL-363 - restricted to PDF at the picker (per-criterion 5, even though
  // the server's shared upload allow-list is broader) and again by
  // validateResumeFile in case the OS reports a mismatched mimeType.
  async function handlePickResume() {
    setResumeError('');

    const result = await DocumentPicker.getDocumentAsync({
      type: RESUME_DOCUMENT_PICKER_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    const validationError = validateResumeFile({ fileSize: asset.size, mimeType: asset.mimeType });
    if (validationError) {
      setResumeError(validationError);
      return;
    }

    setResumeUploading(true);
    try {
      const url = await uploadApi.uploadFile(asset, 'resumes');
      setResume({ name: asset.name, size: asset.size, url });
    } catch (error) {
      setResumeError(error.response?.data?.error?.message || GENERIC_RESUME_UPLOAD_ERROR);
    } finally {
      setResumeUploading(false);
    }
  }

  // Removing leaves the application with no resume rather than an empty
  // string (GL-300 AC6) - handleSubmit sends `resume?.url`, so clearing this
  // state is enough; there is nothing server-side to un-set.
  function handleRemoveResume() {
    setResume(null);
    setResumeError('');
  }

  async function handleSubmit() {
    // Belt-and-braces alongside Button's own `loading` → disabled onPress:
    // the guard that actually has to hold is here, not in the JSX.
    if (submitting) return;

    setFormError(null);
    setSubmitting(true);
    try {
      const { application } = await applicationApi.apply(
        gigId,
        toSkillTrialSubmissionBody(trialSubmission),
        resume?.url,
      );
      navigation.replace('ApplicationDetail', { applicationId: application.id });
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'GIG_CLOSED') {
        setFormError({
          message:
            "This gig closed while you were applying - it's no longer accepting applications.",
        });
      } else if (apiError?.code === 'APPLICATION_ALREADY_EXISTS') {
        setFormError({
          message: 'You already have an application for this gig.',
          actionLabel: 'View your application',
          onAction: () => navigation.navigate('Main', { screen: 'My Applications' }),
        });
      } else if (apiError?.code === 'TRIAL_ALREADY_SUBMITTED') {
        // Reachable if a stale screen resubmits after the trial already
        // landed on an earlier application for this gig (§11.7) - not a
        // race this screen's own state can otherwise produce, since a
        // locked trial already blocks a second "Submit trial" tap.
        setFormError({
          message: 'A trial has already been submitted for this application.',
        });
      } else if (
        apiError?.code === 'VALIDATION_ERROR' &&
        apiError.errors?.some((fieldError) => fieldError.field?.startsWith('skillTrialSubmission'))
      ) {
        // The seeker's typed response/attachment is what the server refused
        // - unlock the trial so "Open the task →" lets them fix it, rather
        // than leaving it locked with no way back in (§298's finality
        // promise is about a trial that succeeded, not one that didn't).
        setTrialNeedsRevision(true);
        setFormError({
          message: apiError.errors[0]?.message || apiError.message,
          actionLabel: 'Edit your response',
          onAction: () => navigation.navigate('SkillTrial', { gigId, locked: false }),
        });
      } else if (apiError?.code === 'FORBIDDEN') {
        setFormError({ message: BUSINESS_REFUSAL_MESSAGE });
      } else {
        setFormError({ message: apiError?.message || GENERIC_SUBMIT_ERROR });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!isSeeker) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Apply" small onBack={handleBack} />
        <EmptyState
          message={BUSINESS_REFUSAL_MESSAGE}
          actionLabel="Go back"
          onAction={handleBack}
        />
      </SafeAreaView>
    );
  }

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

  // GL-355 - the trial block, drawn above the snapshot because it's the
  // blocking step (frame note, #apply). `requirement` is only ever `none` or
  // `optional` (GL-341 removed `required` from the vocabulary entirely - see
  // docs/api-contract.md §6.12), so a gig with a trial here is always
  // `optional`, and an optional trial never blocks Submit (§298 AC9). The
  // "required trial blocks Submit" gate GL-298 AC8 describes has no state
  // that can ever reach it, so there is deliberately no disabling logic
  // below - only the informational card.
  const skillTrial = gig.skillTrial;
  const hasTrial = Boolean(skillTrial) && skillTrial.requirement !== 'none';
  const trialResult = trialSubmission ? 'submitted' : 'not_submitted';
  // Locked once submitted, per the frame's finality promise - unless the
  // server just refused that exact content, in which case it has to be
  // editable again or the seeker has no way to ever apply.
  const trialLocked = Boolean(trialSubmission) && !trialNeedsRevision;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Apply" small onBack={handleBack} />

      <ScrollView contentContainerClassName="px-[22px] pb-8" showsVerticalScrollIndicator={false}>
        {hasTrial ? (
          <View className="mb-6">
            <SectionLabel>Skill trial</SectionLabel>

            <View className="mt-2 rounded-ds-card border-[1.5px] border-line bg-paper p-4">
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 font-display text-title text-ink">
                  {skillTrial.taskTitle}
                </Text>
                <Badge variant="strong">
                  {labelFor(SKILL_TRIAL_REQUIREMENTS, skillTrial.requirement)}
                </Badge>
              </View>

              <View className="mt-3 flex-row flex-wrap items-center gap-[8px]">
                <Badge variant="neutral">
                  {labelFor(SKILL_TRIAL_EFFORT_ESTIMATES, skillTrial.effortEstimate)}
                </Badge>
                <Badge variant="neutral">{labelFor(SKILL_TRIAL_RESULTS, trialResult)}</Badge>
              </View>

              <View className="mt-3 flex-row items-center justify-between gap-3">
                <Text className="text-[12px] text-muted">A sample of skill, not paid work</Text>
                <Text
                  className="text-[13px] font-semibold text-signal"
                  onPress={() =>
                    navigation.navigate('SkillTrial', {
                      gigId,
                      locked: trialLocked,
                      submission: trialSubmission,
                    })
                  }
                >
                  Open the task →
                </Text>
              </View>
            </View>
          </View>
        ) : null}

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
              message="Your profile has no work experience or education yet. Adding some gives the business more to go on - you can still apply without it."
              actionLabel="Update your profile"
              onAction={() => navigation.navigate('Main', { screen: 'Profile' })}
            />
          ) : null}
        </View>

        <View className="mt-6">
          <SectionLabel>Resume (optional)</SectionLabel>

          <View className="mt-2">
            {resume ? (
              <View className="flex-row items-center gap-[13px] rounded-ds-lg border-[1.5px] border-line bg-haze px-[18px] py-[14px]">
                <Pressable onPress={handlePickResume} disabled={resumeUploading} className="flex-1">
                  <Text className="text-body font-medium text-ink" numberOfLines={1}>
                    {resume.name}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-muted">
                    {formatFileSize(resume.size)} · Tap to replace
                  </Text>
                </Pressable>
                <Text
                  className="text-[13px] font-semibold text-signal"
                  onPress={handleRemoveResume}
                >
                  Remove
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handlePickResume}
                disabled={resumeUploading}
                className="flex-row items-center gap-[13px] rounded-ds-lg border-[1.5px] border-dashed border-line bg-haze px-[18px] py-[14px]"
              >
                <Text className="text-[17px] text-muted-dark">↑</Text>
                <View className="flex-1">
                  <Text className="text-body font-medium text-ink">
                    {resumeUploading ? 'Uploading…' : 'Attach a PDF'}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-muted">
                    Up to 5 MB. Your profile is the resume — this is an extra.
                  </Text>
                </View>
              </Pressable>
            )}

            {resumeError ? (
              <Text className="mt-1.5 text-[13px] font-medium text-danger">{resumeError}</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View className="border-t border-line px-[22px] pb-3 pt-3">
        {formError ? (
          <View className="mb-3">
            <Notice variant="error">{formError.message}</Notice>
            {formError.actionLabel ? (
              <Button
                variant="small"
                fullWidth={false}
                className="mt-2 self-start"
                onPress={formError.onAction}
              >
                {formError.actionLabel}
              </Button>
            ) : null}
          </View>
        ) : null}
        <Button onPress={handleSubmit} loading={submitting}>
          Submit application
        </Button>
      </View>
    </SafeAreaView>
  );
}
