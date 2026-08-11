import { useState } from 'react';
import { Image, Text, View } from 'react-native';

const SIZE_STYLES = {
  sm: { box: 'h-[34px] w-[34px]', text: 'text-[12.5px]' },
  md: { box: 'h-11 w-11', text: 'text-[15px]' },
  lg: { box: 'h-[84px] w-[84px]', text: 'text-[26px]' },
};

function getInitials(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Avatar({ uri, name, size = 'md', className, ...props }) {
  const [failed, setFailed] = useState(false);
  const sizeStyles = SIZE_STYLES[size] ?? SIZE_STYLES.md;

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        className={['rounded-full', sizeStyles.box, className].filter(Boolean).join(' ')}
        {...props}
      />
    );
  }

  return (
    <View
      className={[
        'items-center justify-center rounded-full border-[1.5px] border-line bg-haze',
        sizeStyles.box,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <Text className={['font-display text-ink', sizeStyles.text].join(' ')}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
