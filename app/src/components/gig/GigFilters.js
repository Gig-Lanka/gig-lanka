import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import Chip from '../ui/Chip';
import TextInput from '../ui/TextInput';
import {
  COMMITMENT_LENGTHS,
  GIG_CATEGORIES,
  GIG_SORT_ORDERS,
  SCHEDULE_TAGS,
} from '../../constants/enums';

const DEFAULT_SORT = 'newest';

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function FilterGroup({ label, children }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 text-label text-ink">{label}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

// Schedule is deliberately not part of this component's own draft state - it
// is the same `schedule`/`onToggleSchedule` pair BrowseGigsScreen hands to
// the on-screen chip row, so the two are one piece of state rather than two
// copies that can disagree. Commitment, category, sort, city and minPay have
// no on-screen counterpart, so they draft locally and only reach the screen
// when "Show gigs" is pressed.
export default function GigFilters({
  visible,
  onRequestClose,
  schedule,
  onToggleSchedule,
  commitment,
  category,
  sort,
  city,
  minPay,
  onClear,
  onApply,
}) {
  const [wasVisible, setWasVisible] = useState(false);
  const [draftCommitment, setDraftCommitment] = useState(commitment);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftSort, setDraftSort] = useState(sort);
  const [draftCity, setDraftCity] = useState(city);
  const [draftMinPay, setDraftMinPay] = useState(minPay);

  // Re-seeds the draft from whatever is currently applied every time the
  // sheet opens, so reopening it shows the filters actually in effect
  // rather than whatever was left over from the last time it was open.
  // Adjusting state during render (React's documented pattern for this)
  // rather than in an effect, since this only needs to run against the
  // props already available this render, not after a commit.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraftCommitment(commitment);
      setDraftCategory(category);
      setDraftSort(sort);
      setDraftCity(city);
      setDraftMinPay(minPay);
    }
  }

  const handleClear = () => {
    setDraftCommitment([]);
    setDraftCategory([]);
    setDraftSort(DEFAULT_SORT);
    setDraftCity('');
    setDraftMinPay('');
    onClear();
  };

  const handleShowGigs = () => {
    onApply({
      commitment: draftCommitment,
      category: draftCategory,
      sort: draftSort,
      city: draftCity,
      minPay: draftMinPay,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable className="flex-1 justify-end bg-ink/[0.46]" onPress={onRequestClose}>
          <Pressable className="max-h-[88%] rounded-t-ds-sheet bg-paper pt-3.5" onPress={() => {}}>
            <View className="mx-auto h-[5px] w-11 rounded-full bg-line" />

            <View className="mt-4 flex-row items-center justify-between px-[22px]">
              <Text className="font-display text-title text-ink">Filter gigs</Text>
              <Pressable onPress={onRequestClose} hitSlop={8}>
                <Text className="text-body font-semibold text-muted">Close</Text>
              </Pressable>
            </View>

            <ScrollView
              className="mt-5 px-[22px]"
              contentContainerClassName="pb-8"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FilterGroup label="When can you work?">
                {SCHEDULE_TAGS.map((tag) => (
                  <Chip
                    key={tag.value}
                    selected={schedule.includes(tag.value)}
                    onPress={() => onToggleSchedule(tag.value)}
                  >
                    {tag.label}
                  </Chip>
                ))}
              </FilterGroup>

              <FilterGroup label="How long for?">
                {COMMITMENT_LENGTHS.map((item) => (
                  <Chip
                    key={item.value}
                    selected={draftCommitment.includes(item.value)}
                    onPress={() => setDraftCommitment((prev) => toggleValue(prev, item.value))}
                  >
                    {item.label}
                  </Chip>
                ))}
              </FilterGroup>

              <FilterGroup label="Category">
                {GIG_CATEGORIES.map((item) => (
                  <Chip
                    key={item.value}
                    selected={draftCategory.includes(item.value)}
                    onPress={() => setDraftCategory((prev) => toggleValue(prev, item.value))}
                  >
                    {item.label}
                  </Chip>
                ))}
              </FilterGroup>

              <FilterGroup label="Sort by">
                {GIG_SORT_ORDERS.map((item) => (
                  <Chip
                    key={item.value}
                    selected={draftSort === item.value}
                    onPress={() => setDraftSort(item.value)}
                  >
                    {item.label}
                  </Chip>
                ))}
              </FilterGroup>

              <TextInput
                label="City"
                placeholder="Colombo"
                value={draftCity}
                onChangeText={setDraftCity}
              />
              <TextInput
                label="Minimum pay (Rs)"
                placeholder="1000"
                value={draftMinPay}
                onChangeText={setDraftMinPay}
                keyboardType="numeric"
              />

              <View className="mt-2 flex-row gap-3">
                <Pressable
                  onPress={handleClear}
                  className="h-[54px] flex-1 items-center justify-center rounded-ds-lg border-[1.5px] border-line bg-paper"
                >
                  <Text className="text-body font-semibold text-ink">Clear</Text>
                </Pressable>
                <Pressable
                  onPress={handleShowGigs}
                  className="h-[54px] flex-1 items-center justify-center rounded-ds-lg bg-ink"
                >
                  <Text className="text-body font-semibold text-paper">Show gigs</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
