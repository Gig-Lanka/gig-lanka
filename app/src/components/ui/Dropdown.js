import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export default function Dropdown({
  label,
  error,
  disabled = false,
  placeholder = 'Select an option',
  options = [],
  value,
  onChange,
  className,
  containerClassName,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const triggerRef = useRef(null);
  const selected = options.find((option) => option.value === value);

  const openMenu = () => {
    if (disabled) return;
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  return (
    <View className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      {label ? <Text className="mb-1.5 text-sm font-medium text-text-primary">{label}</Text> : null}

      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        disabled={disabled}
        className={[
          'flex-row items-center justify-between rounded-md border px-4 py-2.5',
          error ? 'border-danger' : 'border-border',
          disabled ? 'bg-bg-soft opacity-60' : 'bg-bg-card',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        <Text className={selected ? 'text-base text-text-primary' : 'text-base text-text-muted'}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text className="text-text-secondary">▾</Text>
      </Pressable>

      {error ? <Text className="mt-1 text-xs text-danger-text">{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          {anchor ? (
            <View
              className="absolute rounded-md border border-border bg-bg-card"
              style={{ top: anchor.y + anchor.height + 4, left: anchor.x, width: anchor.width }}
            >
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  className={['px-4 py-3', option.value === value ? 'bg-primary-soft' : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <Text
                    className={
                      option.value === value
                        ? 'text-base font-semibold text-primary'
                        : 'text-base text-text-primary'
                    }
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
