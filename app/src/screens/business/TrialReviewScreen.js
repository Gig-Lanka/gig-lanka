// GL-358 - TrialReviewScreen.js from the v3 mockup (#trial-review).
// Registered in RootNavigator's business branch only (AC11).
//
// Fetches its own data from just { applicationId } - the same
// getApplication()-then-getGig() pair ApplicantsScreen.js already runs for
// its gig-scoped list, so this screen doesn't ask GL-360's entry point for
// anything beyond the id it already has. `getApplication` returns the gig
// only as the §11.6 summary (no `skillTrial`), which is why the task title,
// brief, effort estimate and submission type need the second call.
//
// The Passed/Not passed buttons are deliberately inert here - no `onPress`,
// no loading/disabled state - matching the same "present but inert until a
// later sub-task wires it" pattern ApplicantActionRow.js and ApplicantRow.js
// already use elsewhere in this component. GL-359 wires the PATCH call, the
// already-reviewed read-only swap and the 409 refetch; this screen always
// renders the not-yet-reviewed layout the frame draws.
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import applicationApi from '../../api/applicationApi';
import gigApi from '../../api/gigApi';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import TextInput from '../../components/ui/TextInput';
import { SKILL_TRIAL_EFFORT_ESTIMATES, SKILL_TRIAL_SUBMISSION_TYPES } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

const LOAD_ERROR_MESSAGE = 'Could not load this trial. Check your connection and try again.';

// §11.18's own field limit, mirrored here the same way RejectReasonSheet.js
// mirrors the server's 300-character rejectionNote cap.
const NOTE_MAX_LENGTH = 300;

function labelFor(list, value) {
  return list.find((item) => item.value === value)?.label ?? value;
}

// The server only ever returns `fileUrl` (§11.1) - no stored display name -
// so the file's name is read off its own URL, the closest thing to "its
// name" the API gives this screen.
function fileNameFromUrl(url) {
  if (!url) return '';
  try {
    return decodeURIComponent(url).split('/').pop();
  } catch {
    return url.split('/').pop();
  }
}

export default function TrialReviewScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { applicationId } = params;

  const [application, setApplication] = useState(null);
  const [task, setTask] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const [note, setNote] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadTrial() {
        try {
          const { application: fetchedApplication } =
            await applicationApi.getApplication(applicationId);
          const { gig: fetchedGig } = await gigApi.getGig(fetchedApplication.gig.id);
          if (cancelled) return;
          setApplication(fetchedApplication);
          setTask(fetchedGig.skillTrial ?? null);
          setStatus(STATUS.READY);
        } catch {
          if (!cancelled) setStatus(STATUS.ERROR);
        }
      }

      setStatus(STATUS.LOADING);
      loadTrial();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applicationId, reloadToken]),
  );

  const handleBack = () => navigation.goBack();

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Trial review" small onBack={handleBack} />
        <EmptyState
          message={LOAD_ERROR_MESSAGE}
          actionLabel="Retry"
          onAction={() => setReloadToken((value) => value + 1)}
        />
      </SafeAreaView>
    );
  }

  const { profileSnapshot, skillTrialSubmission } = application;

  // Unreachable from GL-360's entry point, which only offers this route for
  // a gig that carries a trial and an application that submitted one - but a
  // stale deep link shouldn't crash the screen, same guard SkillTrialScreen
  // uses for the seeker side.
  if (!task || task.requirement === 'none' || !skillTrialSubmission) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Trial review" small onBack={handleBack} />
        <EmptyState
          message="This application has no skill trial to review."
          actionLabel="Go back"
          onAction={handleBack}
        />
      </SafeAreaView>
    );
  }

  const { taskTitle, taskBrief, submissionType, effortEstimate } = task;
  const { textResponse, fileUrl, submittedAt } = skillTrialSubmission;
  const showResponse =
    Boolean(textResponse) && (submissionType === 'text' || submissionType === 'text_and_file');
  const showAttachment =
    Boolean(fileUrl) && (submissionType === 'file' || submissionType === 'text_and_file');
  const firstName = profileSnapshot?.name?.split(' ')[0] || 'them';

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Trial review" small onBack={handleBack} />

      <View className="flex-row items-center gap-3 px-[22px] pb-4">
        <Avatar name={profileSnapshot?.name} size="sm" />
        <View className="flex-1">
          <Text className="font-display text-title text-ink">{profileSnapshot?.name}</Text>
          <Text className="mt-0.5 text-[12.5px] text-muted-dark">
            Submitted {formatRelativeTime(submittedAt)}
          </Text>
        </View>
        <Badge variant="warning">Submitted</Badge>
      </View>

      <ScrollView contentContainerClassName="px-[22px] pb-4" showsVerticalScrollIndicator={false}>
        <View className="rounded-ds-card bg-haze p-4">
          <Text className="font-display text-title text-ink">{taskTitle}</Text>
          <Text className="mt-1.5 text-[12.5px] text-muted-dark">
            {labelFor(SKILL_TRIAL_EFFORT_ESTIMATES, effortEstimate)} ·{' '}
            {labelFor(SKILL_TRIAL_SUBMISSION_TYPES, submissionType).toLowerCase()} response
          </Text>
        </View>

        {taskBrief ? (
          <Text className="mt-3 text-[13.5px] leading-[19.5px] text-muted-dark">{taskBrief}</Text>
        ) : null}

        {showResponse ? (
          <>
            <SectionLabel className="mb-2 mt-5">Their response</SectionLabel>
            <View className="rounded-ds-card border-[1.5px] border-line bg-paper p-4">
              <Text className="text-[14px] leading-[19.6px] text-ink">{textResponse}</Text>
            </View>
          </>
        ) : null}

        {showAttachment ? (
          <View className="mt-5">
            <Text className="mb-2 text-label text-ink">Attachment</Text>
            <Pressable
              onPress={() => Linking.openURL(fileUrl)}
              className="flex-row items-center gap-[13px] rounded-ds-lg border-[1.5px] border-line bg-haze px-[18px] py-[14px]"
            >
              <View className="flex-1">
                <Text className="text-body font-medium text-ink" numberOfLines={1}>
                  {fileNameFromUrl(fileUrl)}
                </Text>
                <Text className="mt-0.5 text-[12px] text-muted">Tap to open</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-5">
          <TextInput
            label={`Note to ${firstName} (optional)`}
            placeholder="Say what worked, or what didn't…"
            multiline
            value={note}
            onChangeText={setNote}
            maxLength={NOTE_MAX_LENGTH}
            containerClassName="mb-0"
          />
          <Text className="mt-1.5 text-right text-[11.5px] font-medium text-muted-dark">
            {note.length} / {NOTE_MAX_LENGTH}
          </Text>
        </View>

        <Notice className="mt-5">
          A trial can only be marked once — pass and fail are both final. A pass appears publicly on
          their profile; a fail is only ever seen by them and you.
        </Notice>
      </ScrollView>

      <View className="border-t border-line px-[22px] pb-3 pt-3">
        <View className="flex-row gap-[10px]">
          <Button variant="outline" fullWidth={false} className="flex-1">
            Not passed
          </Button>
          <Button fullWidth={false} className="flex-1">
            Passed
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
