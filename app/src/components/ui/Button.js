import { ActivityIndicator, Pressable, Text } from 'react-native';

const VARIANT_STYLES = {
  primary: {
    container: 'bg-primary active:bg-primary-hover',
    text: 'text-white',
    spinnerColor: '#ffffff',
  },
  secondary: {
    container: 'bg-secondary active:bg-primary-soft',
    text: 'text-primary',
    spinnerColor: '#5b4bff',
  },
  outline: {
    container: 'bg-transparent border border-primary active:bg-primary-soft',
    text: 'text-primary',
    spinnerColor: '#5b4bff',
  },
  danger: {
    container: 'bg-danger active:bg-danger-text',
    text: 'text-white',
    spinnerColor: '#ffffff',
  },
};

const SIZE_STYLES = {
  small: { container: 'px-3 py-1.5', text: 'text-sm' },
  medium: { container: 'px-4 py-2.5', text: 'text-base' },
  large: { container: 'px-6 py-3.5', text: 'text-lg' },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  onPress,
  className,
  ...props
}) {
  const isDisabled = disabled || loading;
  const variantStyles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
  const sizeStyles = SIZE_STYLES[size] ?? SIZE_STYLES.medium;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      className={[
        'flex-row items-center justify-center rounded-md',
        sizeStyles.container,
        variantStyles.container,
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.spinnerColor} />
      ) : (
        <Text
          className={['font-semibold', sizeStyles.text, variantStyles.text]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
