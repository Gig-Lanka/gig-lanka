import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

// A character-count proxy for "would this wrap past a few lines", rather
// than measuring rendered layout - simple, deterministic, and well under
// the 300-character cap the server enforces on a report's note.
const NOTE_PREVIEW_LENGTH = 140;

// Full note or a clear truncation with a way to read the rest (GL-306
// criterion 7) - expanding it is a read affordance, not an action on the
// report, so it doesn't trip criterion 9's "not one action anywhere".
// Shared by the admin ReportsScreen and the reporter's MyReportsScreen
// (GL-446) so the two can't drift apart.
export default function ReportNote({ note }) {
  const [expanded, setExpanded] = useState(false);

  if (!note) return null;

  const needsTruncation = note.length > NOTE_PREVIEW_LENGTH;
  const shown =
    expanded || !needsTruncation ? note : `${note.slice(0, NOTE_PREVIEW_LENGTH).trimEnd()}…`;

  return (
    <View className="mt-2">
      <Text className="text-[13.5px] leading-[1.5] text-muted">{shown}</Text>
      {needsTruncation ? (
        <Pressable onPress={() => setExpanded((value) => !value)} className="mt-1 self-start">
          <Text className="text-[12.5px] font-semibold text-signal">
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
