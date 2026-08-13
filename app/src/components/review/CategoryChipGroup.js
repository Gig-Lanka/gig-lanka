import { View } from 'react-native';
import Chip from '../ui/Chip';

export default function CategoryChipGroup({
  categories,
  value = [],
  onChange,
  className,
  ...props
}) {
  function toggle(categoryValue) {
    if (!onChange) return;
    const next = value.includes(categoryValue)
      ? value.filter((selected) => selected !== categoryValue)
      : [...value, categoryValue];
    onChange(next);
  }

  return (
    <View className={['flex-row flex-wrap gap-2', className].filter(Boolean).join(' ')} {...props}>
      {categories.map((category) => (
        <Chip
          key={category.value}
          selected={value.includes(category.value)}
          onPress={() => toggle(category.value)}
        >
          {category.label}
        </Chip>
      ))}
    </View>
  );
}
