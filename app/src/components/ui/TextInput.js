import { Text, TextInput as RNTextInput, View } from 'react-native';

export default function TextInput({
  label,
  error,
  disabled = false,
  secureTextEntry = false,
  className,
  containerClassName,
  ...props
}) {
  return (
    <View className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-text-primary">{label}</Text>
      ) : null}

      <RNTextInput
        editable={!disabled}
        secureTextEntry={secureTextEntry}
        placeholderTextColor="#9ca3af"
        className={[
          'rounded-md border px-4 py-2.5 text-base text-text-primary',
          error ? 'border-danger' : 'border-border',
          disabled ? 'bg-bg-soft opacity-60' : 'bg-bg-card',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />

      {error ? <Text className="mt-1 text-xs text-danger-text">{error}</Text> : null}
    </View>
  );
}
