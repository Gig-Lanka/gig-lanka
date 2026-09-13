// GL-354 - SkillTrialScreen.js from the v3 mockup (#skill-trial). Registered
// in RootNavigator's seeker branch alongside Apply, not as a nested flow -
// see RootNavigator.js.
//
// The submission built here does not post anywhere on its own: per the
// parent story (GL-298) it travels with the application, so Submit trial
// only assembles { textResponse, fileUrl } and hands it back to Apply via
// navigation params - one of the two options the story's technical notes
// name for this. GL-357 owns finishing that hand-off (locking a submitted
// trial read-only, and actually sending it on POST .../applications).
//
// The "Required" badge state the frame and parent story describe cannot
// occur: GL-341 removed `required` from skillTrial.requirement across the
// stack (server model/validator, app/src/constants/enums.js,
// docs/api-contract.md §6.12) - a trial reaching this screen is always
// `optional`. The badge below reads its label from SKILL_TRIAL_REQUIREMENTS
// rather than hardcoding "Required", so it can never show a state the data
// can't produce - the same `attached = requirement === 'optional'` shape
// GigForm.js already uses.

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';

import gigApi from '../../api/gigApi';
import { uploadApi } from '../../api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import TextInput from '../../components/ui/TextInput';
import { SKILL_TRIAL_EFFORT_ESTIMATES, SKILL_TRIAL_REQUIREMENTS } from '../../constants/enums';
import { formatFileSize } from '../../utils/format';
import {
  SKILL_TRIAL_RESPONSE_MAX_LENGTH,
  SKILL_TRIAL_RESPONSE_MIN_LENGTH,
  isValidSkillTrialResponse,
  validateTrialAttachmentFile,
} from '../../utils/validation';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error', NOT_FOUND: 'not_found' };

const LOAD_ERROR_MESSAGE = 'Could not load this screen. Check your connection and try again.';

const CALM_NOTICE =
  'This is a sample of skill, never work the business would otherwise pay for. Effort is capped at two hours.';

const GENERIC_UPLOAD_ERROR = 'Could not upload the file. Check your connection and try again.';

const DOCUMENT_PICKER_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

function labelFor(list, value) {
  return list.find((item) => item.value === value)?.label ?? value;
}

export default function SkillTrialScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { gigId } = params;

  const [gig, setGig] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  const [textResponse, setTextResponse] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadGig() {
        try {
          const { gig: gigData } = await gigApi.getGig(gigId);
          if (cancelled) return;
          setGig(gigData);
          setStatus(STATUS.READY);
        } catch (error) {
          if (cancelled) return;
          const isNotFound =
            error.response?.status === 404 || error.response?.data?.error?.code === 'NOT_FOUND';
          setStatus(isNotFound ? STATUS.NOT_FOUND : STATUS.ERROR);
        }
      }

      setStatus(STATUS.LOADING);
      loadGig();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gigId, reloadToken]),
  );

  const handleBack = () => navigation.goBack();

  async function handlePickAttachment() {
    setUploadError('');

    const result = await DocumentPicker.getDocumentAsync({
      type: DOCUMENT_PICKER_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    const validationError = validateTrialAttachmentFile({
      fileSize: asset.size,
      mimeType: asset.mimeType,
    });
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    try {
      const url = await uploadApi.uploadFile(asset, 'trials');
      setAttachment({ name: asset.name, size: asset.size, url });
    } catch (error) {
      setUploadError(error.response?.data?.error?.message || GENERIC_UPLOAD_ERROR);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmitTrial(canSubmit, showResponseField, showAttachment) {
    if (!canSubmit) return;

    const trialSubmission = {};
    if (showResponseField) trialSubmission.textResponse = textResponse.trim();
    if (showAttachment) trialSubmission.fileUrl = attachment.url;

    // Not a network call - GL-357 sends this with the application itself
    // (docs/api-contract.md §11.7). Handing it back through navigation
    // params, since Apply and SkillTrial are flat siblings under the seeker
    // stack rather than a nested flow (see RootNavigator.js).
    navigation.navigate('Apply', { gigId, trialSubmission });
  }

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.NOT_FOUND) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Skill trial" small onBack={handleBack} />
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
        <ScreenHeader title="Skill trial" small onBack={handleBack} />
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

  const skillTrial = gig.skillTrial;

  // Unreachable in practice - Apply only ever routes here for a gig that
  // carries a trial - but a stale deep link shouldn't crash the screen.
  if (!skillTrial || skillTrial.requirement === 'none') {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Skill trial" small onBack={handleBack} />
        <EmptyState
          message="This gig has no skill trial to complete."
          actionLabel="Go back"
          onAction={handleBack}
        />
      </SafeAreaView>
    );
  }

  const { taskTitle, taskBrief, submissionType, effortEstimate, requirement } = skillTrial;
  const showResponseField = submissionType === 'text' || submissionType === 'text_and_file';
  const showAttachment = submissionType === 'file' || submissionType === 'text_and_file';

  const trimmedLength = textResponse.trim().length;
  const responseValid = !showResponseField || isValidSkillTrialResponse(textResponse);
  const attachmentValid = !showAttachment || Boolean(attachment);
  const canSubmit = responseValid && attachmentValid && !uploading;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Skill trial" small onBack={handleBack} />

      <ScrollView contentContainerClassName="px-[22px] pb-4" showsVerticalScrollIndicator={false}>
        <Text className="font-display text-title text-ink">{taskTitle}</Text>

        <View className="mt-3 flex-row flex-wrap items-center gap-[8px]">
          <Badge variant="strong">{labelFor(SKILL_TRIAL_REQUIREMENTS, requirement)}</Badge>
          <Badge variant="neutral">{labelFor(SKILL_TRIAL_EFFORT_ESTIMATES, effortEstimate)}</Badge>
        </View>

        <Text className="mt-4 text-[13.5px] leading-[19.5px] text-muted-dark">{taskBrief}</Text>

        <Notice className="mt-4">{CALM_NOTICE}</Notice>

        {showResponseField ? (
          <View className="mt-5">
            <TextInput
              label="Your response"
              placeholder="Write your response…"
              multiline
              value={textResponse}
              onChangeText={setTextResponse}
              maxLength={SKILL_TRIAL_RESPONSE_MAX_LENGTH}
              containerClassName="mb-0"
            />
            <Text
              className={[
                'mt-1.5 text-right text-[11.5px] font-medium',
                trimmedLength < SKILL_TRIAL_RESPONSE_MIN_LENGTH ? 'text-danger' : 'text-muted-dark',
              ].join(' ')}
            >
              {`${trimmedLength} / ${SKILL_TRIAL_RESPONSE_MAX_LENGTH} · ${SKILL_TRIAL_RESPONSE_MIN_LENGTH} minimum`}
            </Text>
          </View>
        ) : null}

        {showAttachment ? (
          <View className="mt-5">
            <Text className="mb-2 text-label text-ink">Attachment</Text>

            {attachment ? (
              <Pressable
                onPress={handlePickAttachment}
                disabled={uploading}
                className="flex-row items-center gap-[13px] rounded-ds-lg border-[1.5px] border-line bg-haze px-[18px] py-[14px]"
              >
                <View className="flex-1">
                  <Text className="text-body font-medium text-ink" numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-muted">
                    {formatFileSize(attachment.size)} · Tap to replace
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={handlePickAttachment}
                disabled={uploading}
                className="flex-row items-center gap-[13px] rounded-ds-lg border-[1.5px] border-dashed border-line bg-haze px-[18px] py-[14px]"
              >
                <Text className="text-[17px] text-muted-dark">↑</Text>
                <View className="flex-1">
                  <Text className="text-body font-medium text-ink">
                    {uploading ? 'Uploading…' : 'Add a file'}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-muted">
                    PDF, PNG or JPG · up to 5 MB
                  </Text>
                </View>
              </Pressable>
            )}

            {uploadError ? (
              <Text className="mt-1.5 text-[13px] font-medium text-danger">{uploadError}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t border-line px-[22px] pb-3 pt-3">
        <Button
          onPress={() => handleSubmitTrial(canSubmit, showResponseField, showAttachment)}
          disabled={!canSubmit}
        >
          Submit trial
        </Button>
        <Text className="mt-2 text-center text-[12px] font-medium text-muted">
          You can&apos;t edit a trial after submitting
        </Text>
      </View>
    </SafeAreaView>
  );
}
