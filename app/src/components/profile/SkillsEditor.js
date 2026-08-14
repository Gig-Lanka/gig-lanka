import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import Chip from '../ui/Chip';
import TextInput from '../ui/TextInput';

/**
 * Inline skills editor for the edit-profile form (GL-148) — there is no
 * separate skills screen. Existing skills are chips you tap to remove; the
 * field below adds one at a time.
 */
export default function SkillsEditor({ skills, onChange, className }) {
  const [draft, setDraft] = useState('');

  function removeSkill(skill) {
    onChange(skills.filter((existing) => existing !== skill));
  }

  function addSkill() {
    const trimmed = draft.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setDraft('');
  }

  return (
    <View className={className}>
      {skills.length > 0 ? (
        <View className="flex-row flex-wrap gap-[7px]">
          {skills.map((skill) => (
            <Chip key={skill} size="sm" onPress={() => removeSkill(skill)}>
              {skill} ×
            </Chip>
          ))}
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center gap-2">
        <TextInput
          placeholder="Add a skill"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addSkill}
          returnKeyType="done"
          containerClassName="mb-0 flex-1"
        />
        <Pressable
          onPress={addSkill}
          className="h-[58px] items-center justify-center rounded-ds-lg bg-haze px-4"
        >
          <Text className="text-label text-ink">Add</Text>
        </Pressable>
      </View>
    </View>
  );
}
