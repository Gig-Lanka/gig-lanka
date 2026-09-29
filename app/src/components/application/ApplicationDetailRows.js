import { Linking, Pressable, Text, View } from 'react-native';

import { formatShortDate } from '../../utils/format';

// The label-and-value rows the `#application-detail` frame draws beneath the
// submission card (`.drow`, `.dlabel`, `.dvalue`). Timestamps go through
// `formatShortDate`, the same formatter the business's ApplicantDetailScreen
// uses for `appliedAt`. It has no time of day, so the frame's "18 Jul, 9:12"
// reads "18 Jul" here - no formatter in utils/format.js gives the time.
function DetailRow({ label, value, onPress }) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className="flex-row items-baseline justify-between gap-[14px] border-b border-line py-[9px]"
    >
      <Text className="text-[13.5px] text-muted">{label}</Text>
      <Text
        className={[
          'text-right text-[13.5px] font-semibold',
          onPress ? 'text-signal' : 'text-ink',
        ].join(' ')}
      >
        {value}
      </Text>
    </Container>
  );
}

// Applied always; Viewed reads "Not yet" until the business opens it; Decided
// only once `decidedAt` is stamped - the server sets it on every decided
// status (hired, completed, rejected, withdrawn, closed_filled), so an
// applied, viewed or shortlisted application never shows a Decided row. Resume attached is "None", or a row that opens
// the file the same way the trial's file row does (Linking.openURL). The rows
// render whether or not the application has a skill trial.
export default function ApplicationDetailRows({ application, className }) {
  const { appliedAt, viewedAt, decidedAt, resumeUrl } = application;

  return (
    <View className={className}>
      <DetailRow label="Applied" value={formatShortDate(new Date(appliedAt))} />
      <DetailRow
        label="Viewed"
        value={viewedAt ? formatShortDate(new Date(viewedAt)) : 'Not yet'}
      />
      {decidedAt ? (
        <DetailRow label="Decided" value={formatShortDate(new Date(decidedAt))} />
      ) : null}
      <DetailRow
        label="Resume attached"
        value={resumeUrl ? 'Tap to open' : 'None'}
        onPress={resumeUrl ? () => Linking.openURL(resumeUrl) : undefined}
      />
    </View>
  );
}
