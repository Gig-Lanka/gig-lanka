import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';

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
  const selected = options.find((option) => option.value === value);

  return (
    <View className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      {label ? <Text className="mb-1.5 text-sm font-medium text-text-primary">{label}</Text> : null}

      <Pressable
        onPress={() => !disabled && setOpen(true)}
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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="rounded-t-lg bg-bg-card pb-6 pt-2" onPress={() => {}}>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange?.(item.value);
                    setOpen(false);
                  }}
                  className={['px-4 py-3', item.value === value ? 'bg-primary-soft' : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <Text
                    className={
                      item.value === value
                        ? 'text-base font-semibold text-primary'
                        : 'text-base text-text-primary'
                    }
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
