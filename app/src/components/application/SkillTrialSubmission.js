import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import Badge from '../ui/Badge';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';
import { SKILL_TRIAL_RESULTS } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';

// The seeker's view of their own trial (GL-402), from the `#application-detail`
// frame's "What you submitted" block. The variants are the ones ApplicantRow.js
// already uses for its trial badges - positive for passed, warning for
// submitted, muted for skipped - and not passed is muted too, never danger: a
// business judging a piece of work is an outcome, not an error. Unlike the
// business's row, `not_passed` gets a badge here: this is the only place the
// seeker ever learns it.
const BADGE_VARIANT_BY_RESULT = {
  submitted: 'warning',
  passed: 'positive',
  not_passed: 'muted',
  skipped: 'muted',
};

const RESPONSE_PREVIEW_LINES = 4;

// A character-count proxy for "would this wrap past a few lines" - the same
// approach as ReportNote.js, rather than measuring rendered layout. Below it
// the response is shown in full with no toggle.
const RESPONSE_PREVIEW_LENGTH = 180;

function resultLabel(result) {
  return SKILL_TRIAL_RESULTS.find((entry) => entry.value === result)?.label ?? result;
}

// The server only returns `fileUrl` (§11.1), no stored display name, so the
// name is read off the URL - same as TrialReviewScreen.js.
function fileNameFromUrl(url) {
  if (!url) return '';
  try {
    return decodeURIComponent(url).split('/').pop();
  } catch {
    return url.split('/').pop();
  }
}

function metaLine(result, reviewedAt) {
  if (result === 'submitted') return 'Waiting for the business to mark it';
  if ((result === 'passed' || result === 'not_passed') && reviewedAt) {
    return `Marked ${formatRelativeTime(reviewedAt)}`;
  }
  return null;
}

// `skillTrial` is the §11.6 summary's `{ title, submissionType }` (absent on a
// gig with no trial, and the whole gig is null once deleted) and `submission`
// is the application's own `skillTrialSubmission`. Renders nothing for an
// application that never had a trial.
export default function SkillTrialSubmission({ skillTrial, submission, className }) {
  const [expanded, setExpanded] = useState(false);

  const result = submission?.result;
  if (!BADGE_VARIANT_BY_RESULT[result]) return null;

  const { textResponse, fileUrl, resultNote, reviewedAt } = submission;
  const meta = metaLine(result, reviewedAt);
  const canCollapse = Boolean(textResponse) && textResponse.length > RESPONSE_PREVIEW_LENGTH;

  return (
    <View className={className}>
      <SectionLabel>What you submitted</SectionLabel>

      <Card flat className="mt-2">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-[15px] font-semibold leading-[20px] tracking-[-0.01em] text-ink">
            {skillTrial?.title ?? 'Skill trial'}
          </Text>
          <Badge variant={BADGE_VARIANT_BY_RESULT[result]}>{resultLabel(result)}</Badge>
        </View>
        {meta ? <Text className="mt-2 text-[11.5px] text-muted-dark">{meta}</Text> : null}
      </Card>

      {/* Verbatim - no truncation, no softening - and styled like the
          rejection note above it on this screen. */}
      {resultNote ? (
        <Text className="mt-3 text-desc leading-[21px] text-muted">{resultNote}</Text>
      ) : null}

      {textResponse ? (
        <View className="mt-4">
          <Text className="mb-2 text-label text-ink">Your response</Text>
          <View className="rounded-ds-card border-[1.5px] border-line bg-paper p-4">
            <Text
              numberOfLines={canCollapse && !expanded ? RESPONSE_PREVIEW_LINES : undefined}
              className="text-[14px] leading-[19.6px] text-ink"
            >
              {textResponse}
            </Text>
            {canCollapse ? (
              <Pressable onPress={() => setExpanded((value) => !value)} className="mt-2 self-start">
                <Text className="text-[12.5px] font-semibold text-signal">
                  {expanded ? 'Show less' : 'Show all'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {fileUrl ? (
        <View className="mt-4">
          <Text className="mb-2 text-label text-ink">Your file</Text>
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
    </View>
  );
}
