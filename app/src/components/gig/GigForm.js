import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import Chip from '../ui/Chip';
import Dropdown from '../ui/Dropdown';
import Notice from '../ui/Notice';
import TextInput from '../ui/TextInput';
import {
  COMMITMENT_LENGTHS,
  GIG_CATEGORIES,
  PAY_TYPES,
  SCHEDULE_TAGS,
} from '../../constants/enums';

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateString(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function digitsOnly(text) {
  return text.replace(/[^0-9]/g, '');
}

export function createEmptyGigFormValues() {
  return {
    title: '',
    description: '',
    category: undefined,
    payAmount: '',
    payType: undefined,
    city: '',
    area: '',
    remote: false,
    schedule: [],
    commitment: undefined,
    positions: '1',
    startDate: null,
    applicationsCloseDate: null,
  };
}

function FieldLabel({ children, action }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-label text-ink">{children}</Text>
      {action}
    </View>
  );
}

function ScheduleField({ value = [], onChange, error, disabled }) {
  function toggle(tagValue) {
    const next = value.includes(tagValue)
      ? value.filter((selected) => selected !== tagValue)
      : [...value, tagValue];
    onChange(next);
  }

  return (
    <View className="mb-4">
      <FieldLabel>Schedule</FieldLabel>
      <View className="flex-row flex-wrap gap-2" pointerEvents={disabled ? 'none' : 'auto'}>
        {SCHEDULE_TAGS.map((tag) => (
          <Chip
            key={tag.value}
            selected={value.includes(tag.value)}
            onPress={() => toggle(tag.value)}
          >
            {tag.label}
          </Chip>
        ))}
      </View>
      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}
    </View>
  );
}

function RemoteToggleField({ value, onChange, disabled }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={[
        'mb-4 flex-row items-center justify-between gap-3 rounded-ds-lg bg-haze px-4 py-3.5',
        disabled && 'opacity-40',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className="flex-1 text-[14.5px] font-medium text-ink">
        This gig can be done remotely
      </Text>
      <View
        className={[
          'h-6 w-6 items-center justify-center rounded-[8px]',
          value ? 'bg-signal' : 'border-[1.5px] border-line bg-paper',
        ].join(' ')}
      >
        {value ? <Text className="text-[13px] font-bold text-paper">✓</Text> : null}
      </View>
    </Pressable>
  );
}

function DateField({
  label,
  value,
  onChange,
  minimumDate,
  optional = false,
  placeholder = 'Select a date',
  error,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(
    () => parseDateString(value) || minimumDate || new Date(),
  );

  function openPicker() {
    if (disabled) return;
    setDraftDate(parseDateString(value) || minimumDate || new Date());
    setOpen(true);
  }

  function handleAndroidChange(event, selectedDate) {
    setOpen(false);
    if (event.type === 'set' && selectedDate) {
      onChange(toDateString(selectedDate));
    }
  }

  function handleIosChange(_event, selectedDate) {
    if (selectedDate) setDraftDate(selectedDate);
  }

  function confirmIos() {
    onChange(toDateString(draftDate));
    setOpen(false);
  }

  return (
    <View className="mb-4">
      <FieldLabel
        action={
          optional && value ? (
            <Pressable onPress={() => onChange(null)} hitSlop={8}>
              <Text className="text-[12.5px] font-semibold text-muted">Clear</Text>
            </Pressable>
          ) : null
        }
      >
        {label}
      </FieldLabel>

      <Pressable
        onPress={openPicker}
        disabled={disabled}
        className={[
          'h-[58px] justify-center rounded-ds-lg border-[1.5px] px-[18px]',
          error ? 'border-danger bg-paper' : 'border-transparent bg-haze',
          disabled && 'opacity-40',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Text
          className={
            value ? 'text-body font-medium text-ink' : 'text-body font-normal text-placeholder'
          }
        >
          {value || placeholder}
        </Text>
      </Pressable>

      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      <Modal
        visible={open && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1 justify-end bg-ink/[0.46]" onPress={() => setOpen(false)}>
          <Pressable
            className="rounded-t-ds-sheet bg-paper px-[22px] pb-8 pt-3.5"
            onPress={() => {}}
          >
            <View className="mx-auto mb-3.5 h-[5px] w-11 rounded-full bg-line" />
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              onChange={handleIosChange}
            />
            <Pressable
              onPress={confirmIos}
              className="mt-2 h-[54px] items-center justify-center rounded-ds-lg bg-signal"
            >
              <Text className="text-body font-semibold tracking-[-0.01em] text-paper">Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function GigForm({
  values,
  onChange,
  errors = {},
  formError,
  banner,
  footer,
  disabled = false,
  keyboardVerticalOffset = 0,
}) {
  const isRemote = Boolean(values.remote);

  function set(field, fieldValue) {
    onChange(field, fieldValue);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8 pt-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {banner}
        {banner ? <View className="h-5" /> : null}

        {formError ? <Notice variant="error">{formError}</Notice> : null}
        {formError ? <View className="h-5" /> : null}

        <TextInput
          label="Title"
          placeholder="Weekend café floor staff"
          value={values.title}
          onChangeText={(text) => set('title', text)}
          error={errors.title}
          disabled={disabled}
          maxLength={80}
        />

        <TextInput
          label="What's the work?"
          placeholder="Shifts, location, what they'll actually be doing…"
          value={values.description}
          onChangeText={(text) => set('description', text)}
          error={errors.description}
          disabled={disabled}
          multiline
          maxLength={2000}
        />

        <Dropdown
          label="Category"
          placeholder="Select a category"
          options={GIG_CATEGORIES}
          value={values.category}
          onChange={(next) => set('category', next)}
          error={errors.category}
          disabled={disabled}
        />

        <TextInput
          label="Amount (Rs)"
          placeholder="2500"
          value={values.payAmount != null ? String(values.payAmount) : ''}
          onChangeText={(text) => set('payAmount', digitsOnly(text))}
          error={errors.payAmount}
          disabled={disabled}
          keyboardType="number-pad"
        />

        <Dropdown
          label="How do you pay?"
          placeholder="Select a pay type"
          options={PAY_TYPES}
          value={values.payType}
          onChange={(next) => set('payType', next)}
          error={errors.payType}
          disabled={disabled}
        />

        <TextInput
          label={isRemote ? 'City (optional)' : 'City'}
          placeholder="Colombo"
          value={values.city}
          onChangeText={(text) => set('city', text)}
          error={errors.city}
          hint={isRemote ? 'Not required — this gig is remote.' : undefined}
          disabled={disabled}
        />

        <TextInput
          label="Area"
          placeholder="Nugegoda"
          value={values.area}
          onChangeText={(text) => set('area', text)}
          error={errors.area}
          hint="Optional"
          disabled={disabled}
        />

        <RemoteToggleField
          value={isRemote}
          onChange={(next) => set('remote', next)}
          disabled={disabled}
        />

        <ScheduleField
          value={values.schedule}
          onChange={(next) => set('schedule', next)}
          error={errors.schedule}
          disabled={disabled}
        />

        <Dropdown
          label="How long does it run?"
          placeholder="Select a commitment length"
          options={COMMITMENT_LENGTHS}
          value={values.commitment}
          onChange={(next) => set('commitment', next)}
          error={errors.commitment}
          disabled={disabled}
        />

        <TextInput
          label="How many people do you need?"
          placeholder="1"
          value={values.positions != null ? String(values.positions) : ''}
          onChangeText={(text) => set('positions', digitsOnly(text))}
          error={errors.positions}
          disabled={disabled}
          keyboardType="number-pad"
        />

        <DateField
          label="Starts"
          value={values.startDate}
          onChange={(next) => set('startDate', next)}
          optional
          placeholder="Select a start date"
          error={errors.startDate}
          disabled={disabled}
        />

        <DateField
          label="Applications close"
          value={values.applicationsCloseDate}
          onChange={(next) => set('applicationsCloseDate', next)}
          minimumDate={new Date()}
          optional
          placeholder="Select a closing date (optional)"
          error={errors.applicationsCloseDate}
          disabled={disabled}
        />
      </ScrollView>

      {footer ? <View className="border-t border-line bg-paper pb-2 pt-4">{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}
