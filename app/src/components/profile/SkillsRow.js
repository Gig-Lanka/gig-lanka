import { View } from 'react-native';

import Chip from '../ui/Chip';

/** Read-only skill chips — `.chips` in the v3 mockup. Editing skills is the edit form's job. */
export default function SkillsRow({ skills, className }) {
  return (
    <View className={['flex-row flex-wrap gap-[7px]', className].filter(Boolean).join(' ')}>
      {skills.map((skill) => (
        <Chip key={skill} size="sm">
          {skill}
        </Chip>
      ))}
    </View>
  );
}
