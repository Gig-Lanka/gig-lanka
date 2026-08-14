import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ProgressPips from '../../components/ui/ProgressPips';
import RoleStrip from '../../components/ui/RoleStrip';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import SegmentedControl from '../../components/ui/SegmentedControl';
import TextInput from '../../components/ui/TextInput';
import GigForm, { createEmptyGigFormValues } from '../../components/gig/GigForm';
import CategoryChipGroup from '../../components/review/CategoryChipGroup';
import RatingBars from '../../components/review/RatingBars';
import ReviewCard from '../../components/review/ReviewCard';
import StarRating from '../../components/review/StarRating';
import { BUSINESS_REVIEW_CATEGORIES, YOUTH_WORKER_REVIEW_CATEGORIES } from '../../constants/enums';
import { formatDeadline, formatLocation, formatPay, formatRelativeTime } from '../../utils/format';
import { validateGigForm } from '../../utils/validation';

function Section({ title, children }) {
  return (
    <View className="mb-8">
      <Text className="mb-3 text-lg font-semibold text-text-primary">{title}</Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function ButtonSection() {
  return (
    <>
      <Section title="Button — primary">
        <Button trailingArrow>Continue</Button>
        <Button fullWidth={false} trailingArrow className="self-start">
          Inline action
        </Button>
      </Section>

      <Section title="Button — small">
        <Button variant="small" fullWidth={false} className="self-start">
          Change
        </Button>
      </Section>

      <Section title="Button — states">
        <Button trailingArrow loading>
          Continue
        </Button>
        <Button trailingArrow disabled>
          Disabled
        </Button>
        <Button variant="small" fullWidth={false} disabled className="self-start">
          Change
        </Button>
      </Section>
    </>
  );
}

function TextInputSection() {
  const [email, setEmail] = useState('');
  const [focusedValue, setFocusedValue] = useState('');

  return (
    <Section title="TextInput">
      <TextInput
        label="Resting field"
        placeholder="you@example.com"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        autoFocus
        label="Focused field"
        placeholder="Tap to focus"
        value={focusedValue}
        onChangeText={setFocusedValue}
      />
      <TextInput label="Password" placeholder="Password" secureTextEntry />
      <TextInput label="With error" placeholder="Username" error="This field is required" />
      <TextInput label="Disabled" placeholder="Can't touch this" disabled />
      <TextInput
        label="With hint"
        placeholder="Display name"
        hint="This is shown on your public profile."
      />
      <TextInput
        label="Error replaces hint"
        placeholder="Display name"
        hint="This is shown on your public profile."
        error="Display name is required"
      />
    </Section>
  );
}

function CardSection() {
  return (
    <>
      <Section title="Card — base">
        <Card>
          <Text className="font-display text-title text-ink">Card title</Text>
          <Text className="mt-[5px] text-desc text-muted">
            Consistent padding, background, and border radius for list items and content blocks.
          </Text>
        </Card>
      </Section>

      <Section title="Card — selectable">
        <Card
          title="I'm looking for work"
          description="Browse gigs, apply, and get hired by businesses near you."
          onPress={() => {}}
        />
        <Card
          title="I'm hiring"
          description="Post gigs and find people to get the work done."
          selected
          onPress={() => {}}
        />
      </Section>
    </>
  );
}

function EmptyStateSection() {
  return (
    <Section title="EmptyState">
      <View className="h-64 overflow-hidden rounded-lg border border-border">
        <EmptyState message="No results found." actionLabel="Retry" onAction={() => {}} />
      </View>
    </Section>
  );
}

function LoaderSection() {
  return (
    <Section title="Loader">
      <Text className="mb-1 text-sm text-text-secondary">Inline</Text>
      <Loader />
      <Text className="mb-1 mt-3 text-sm text-text-secondary">Full-screen</Text>
      <View className="h-40 overflow-hidden rounded-lg border border-border">
        <Loader fullScreen />
      </View>
    </Section>
  );
}

function DesignTokensSection() {
  return (
    <Section title="Design tokens — GL-82">
      <Text className="font-display text-h1 text-ink">Aa</Text>
      <Text className="mt-2 text-sm text-text-secondary">
        font-display text-h1 text-ink — verifies the GL-82 token set (Schibsted Grotesk, size, and
        color) renders correctly on device.
      </Text>
    </Section>
  );
}

const COLOR_TOKEN_SWATCHES = [
  { name: 'ink', className: 'bg-ink' },
  { name: 'paper', className: 'bg-paper' },
  { name: 'haze', className: 'bg-haze' },
  { name: 'line', className: 'bg-line' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'muted-dark', className: 'bg-muted-dark' },
  { name: 'signal', className: 'bg-signal' },
  { name: 'signal-soft', className: 'bg-signal-soft' },
  { name: 'signal-ink', className: 'bg-signal-ink' },
  { name: 'danger', className: 'bg-danger' },
  { name: 'danger-soft', className: 'bg-danger-soft' },
  { name: 'danger-ink', className: 'bg-danger-ink' },
  { name: 'success-soft', className: 'bg-success-soft' },
  { name: 'success-ink', className: 'bg-success-ink' },
  { name: 'warning-soft', className: 'bg-warning-soft' },
  { name: 'warning-ink', className: 'bg-warning-ink' },
];

const RADIUS_TOKEN_SWATCHES = [
  { name: 'ds-sheet', className: 'rounded-ds-sheet bg-haze' },
  { name: 'ds-lg', className: 'rounded-ds-lg bg-haze' },
  { name: 'ds-md', className: 'rounded-ds-md bg-haze' },
  { name: 'ds-sm', className: 'rounded-ds-sm bg-haze' },
];

function TokenSwatch({ name, prefix, swatchClassName }) {
  return (
    <View className="w-[84px] items-center gap-1.5">
      <View className={['h-12 w-12 border border-line', swatchClassName].join(' ')} />
      <Text className="text-center text-[10px] text-text-secondary">
        {prefix}
        {name}
      </Text>
    </View>
  );
}

function TokenSwatchSection() {
  return (
    <Section title="Design tokens — v3 swatches (GL-101)">
      <Text className="text-sm text-text-secondary">
        Every v3 colour token and radius from GL-127, rendered from its Tailwind class name so the
        set can be checked on a device instead of read out of tailwind.config.js.
      </Text>

      <View className="mt-1 flex-row flex-wrap gap-4">
        {COLOR_TOKEN_SWATCHES.map((token) => (
          <TokenSwatch
            key={token.name}
            name={token.name}
            prefix="bg-"
            swatchClassName={token.className}
          />
        ))}
      </View>

      <Text className="mb-1 mt-6 text-sm font-medium text-text-primary">Radius — ds-*</Text>
      <View className="flex-row flex-wrap gap-4">
        {RADIUS_TOKEN_SWATCHES.map((token) => (
          <TokenSwatch
            key={token.name}
            name={token.name}
            prefix="rounded-"
            swatchClassName={token.className}
          />
        ))}
      </View>
    </Section>
  );
}

function AuthPrimitivesSection() {
  return (
    <Section title="Auth primitives">
      <View className="self-start rounded-ds-lg bg-ink p-4">
        <Brand />
      </View>
      <ProgressPips total={4} current={2} caption />
      <Notice>
        This sets up your whole account, so pick the one that fits how you&apos;ll mostly use Gig
        Lanka.
      </Notice>
      <Notice variant="error">Something went wrong. Please try again.</Notice>
      <RoleStrip value="I'm looking for work" onAction={() => {}} />
    </Section>
  );
}

function ScreenSection() {
  return (
    <Section title="Screen">
      <Text className="text-sm text-text-secondary">
        This demo screen is itself wrapped in {'<Screen scroll>'} — safe area insets, horizontal
        padding, and scrolling come from it, so nothing below re-implements that layout.
      </Text>
    </Section>
  );
}

function BadgeSection() {
  return (
    <Section title="Badge — GL-129">
      <View className="flex-row flex-wrap gap-2">
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="positive">Positive</Badge>
        <Badge variant="strong">Strong</Badge>
        <Badge variant="muted">Muted</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
      </View>
    </Section>
  );
}

function ChipSection() {
  const [scheduleValue, setScheduleValue] = useState('weekday');
  const [skillSelected, setSkillSelected] = useState(true);

  return (
    <Section title="Chip — GL-129">
      <Text className="text-sm text-text-secondary">Default size, selectable</Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip selected={scheduleValue === 'weekday'} onPress={() => setScheduleValue('weekday')}>
          Weekday evenings
        </Chip>
        <Chip selected={scheduleValue === 'weekends'} onPress={() => setScheduleValue('weekends')}>
          Weekends
        </Chip>
      </View>

      <Text className="mt-3 text-sm text-text-secondary">Small size, selectable</Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip size="sm" selected={skillSelected} onPress={() => setSkillSelected((v) => !v)}>
          Tutoring
        </Chip>
        <Chip size="sm" selected={!skillSelected} onPress={() => setSkillSelected((v) => !v)}>
          Excel
        </Chip>
      </View>

      <Text className="mt-3 text-sm text-text-secondary">Static (no onPress)</Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip>Customer service</Chip>
      </View>
    </Section>
  );
}

function AvatarSection() {
  const imageUri = 'https://i.pravatar.cc/150?img=12';

  return (
    <Section title="Avatar — GL-130">
      <Text className="text-sm text-text-secondary">With image</Text>
      <View className="flex-row items-center gap-4">
        <Avatar uri={imageUri} name="Ashan Perera" size="sm" />
        <Avatar uri={imageUri} name="Ashan Perera" size="md" />
        <Avatar uri={imageUri} name="Ashan Perera" size="lg" />
      </View>

      <Text className="mt-3 text-sm text-text-secondary">No image — initials fallback</Text>
      <View className="flex-row items-center gap-4">
        <Avatar name="Ashan Perera" size="sm" />
        <Avatar name="Ashan Perera" size="md" />
        <Avatar name="Ashan Perera" size="lg" />
      </View>
    </Section>
  );
}

function StarRatingSection() {
  const [interactiveLg, setInteractiveLg] = useState(4);
  const [interactiveSm, setInteractiveSm] = useState(3);
  const [interactiveZero, setInteractiveZero] = useState(0);

  return (
    <Section title="StarRating — GL-198">
      <Text className="text-sm text-text-secondary">Read-only — large</Text>
      <StarRating value={4} size="lg" />

      <Text className="mt-3 text-sm text-text-secondary">Read-only — small</Text>
      <StarRating value={4} size="sm" />

      <Text className="mt-3 text-sm text-text-secondary">Read-only — zero (nothing selected)</Text>
      <StarRating value={0} size="lg" />

      <Text className="mt-3 text-sm text-text-secondary">Interactive — large</Text>
      <StarRating value={interactiveLg} size="lg" onChange={setInteractiveLg} />

      <Text className="mt-3 text-sm text-text-secondary">Interactive — small</Text>
      <StarRating value={interactiveSm} size="sm" onChange={setInteractiveSm} />

      <Text className="mt-3 text-sm text-text-secondary">Interactive — zero (tap to set)</Text>
      <StarRating value={interactiveZero} size="lg" onChange={setInteractiveZero} />
    </Section>
  );
}

function ReviewCardSection() {
  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '
    .repeat(18)
    .slice(0, 1000);

  const noCategoriesReview = {
    id: 'demo-review-1',
    application: 'demo-application-1',
    author: 'demo-author-1',
    subject: 'demo-subject-1',
    direction: 'seeker_to_business',
    rating: 4,
    categories: [],
    text: 'Great to work with, showed up on time and the brief was easy to follow.',
    createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
  };

  const sixCategoriesReview = {
    id: 'demo-review-2',
    application: 'demo-application-2',
    author: 'demo-author-2',
    subject: 'demo-subject-2',
    direction: 'business_to_seeker',
    rating: 5,
    categories: YOUTH_WORKER_REVIEW_CATEGORIES.map((category) => category.value),
    text: 'Consistently reliable across the whole engagement, would hire again without hesitation.',
    createdAt: new Date(now.getTime() - 9 * DAY_MS),
  };

  const longTextReview = {
    id: 'demo-review-3',
    application: 'demo-application-3',
    author: 'demo-author-3',
    subject: 'demo-subject-3',
    direction: 'seeker_to_business',
    rating: 3,
    categories: ['fair_payment', 'communication'],
    text: longText,
    createdAt: new Date(now.getTime() - 45 * 60 * 1000),
  };

  return (
    <Section title="ReviewCard — GL-199">
      <Text className="text-sm text-text-secondary">No categories</Text>
      <ReviewCard
        review={noCategoriesReview}
        authorName="Amaya's Café"
        authorAvatarUrl="https://i.pravatar.cc/150?img=32"
      />

      <Text className="mt-3 text-sm text-text-secondary">Six categories</Text>
      <ReviewCard review={sixCategoriesReview} authorName="Nuwan Fernando" />

      <Text className="mt-3 text-sm text-text-secondary">1000-character text</Text>
      <ReviewCard
        review={longTextReview}
        authorName="Sanduni Perera"
        authorAvatarUrl="https://i.pravatar.cc/150?img=47"
      />
    </Section>
  );
}

function CategoryChipGroupSection() {
  const [selected, setSelected] = useState(['work_quality', 'punctuality']);

  return (
    <Section title="CategoryChipGroup — GL-199">
      <Text className="text-sm text-text-secondary">Interactive — multi-select</Text>
      <CategoryChipGroup
        categories={YOUTH_WORKER_REVIEW_CATEGORIES}
        value={selected}
        onChange={setSelected}
      />

      <Text className="mt-3 text-sm text-text-secondary">Nothing selected</Text>
      <CategoryChipGroup categories={BUSINESS_REVIEW_CATEGORIES} value={[]} onChange={() => {}} />

      <Text className="mt-3 text-sm text-text-secondary">Everything selected</Text>
      <CategoryChipGroup
        categories={BUSINESS_REVIEW_CATEGORIES}
        value={BUSINESS_REVIEW_CATEGORIES.map((category) => category.value)}
        onChange={() => {}}
      />
    </Section>
  );
}

function RatingBarsSection() {
  return (
    <Section title="RatingBars — GL-200">
      <Text className="text-sm text-text-secondary">Normal distribution</Text>
      <RatingBars distribution={{ 5: 9, 4: 2, 3: 1, 2: 0, 1: 0 }} />

      <Text className="mt-3 text-sm text-text-secondary">Zero reviews</Text>
      <RatingBars distribution={{}} />
    </Section>
  );
}

function GigFormSection() {
  const [values, setValues] = useState(createEmptyGigFormValues());

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Section title="GigForm — GL-119">
      <Text className="text-sm text-text-secondary">
        Controlled — values and onChange only, no network call. Scroll and open the keyboard inside
        the box below to check keyboard avoidance.
      </Text>
      <View className="h-[560px] overflow-hidden rounded-lg border border-border">
        <GigForm values={values} onChange={handleChange} />
      </View>

      <Text className="mt-3 text-sm text-text-secondary">With field errors and a form error</Text>
      <View className="h-[560px] overflow-hidden rounded-lg border border-border">
        <GigForm
          values={values}
          onChange={handleChange}
          formError="Could not post this gig. Check your connection and try again."
          errors={{
            title: 'Title is required.',
            schedule: 'Pick at least one schedule slot.',
          }}
        />
      </View>
    </Section>
  );
}

function GigFormRulesSection() {
  const [values, setValues] = useState({
    ...createEmptyGigFormValues(),
    payAmount: '0',
    positions: '',
  });
  const [errors, setErrors] = useState(null);

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Section title="GigForm — non-negotiable rules (GL-166)">
      <Text className="text-sm text-text-secondary">
        Title/description are blank, pay starts at 0, positions starts blank and nothing is remote.
        Tap Validate to run validateGigForm, then flip the remote toggle to see the City requirement
        change.
      </Text>
      <Button
        variant="small"
        fullWidth={false}
        className="self-start"
        onPress={() => setErrors(validateGigForm(values))}
      >
        Validate
      </Button>
      <View className="h-[620px] overflow-hidden rounded-lg border border-border">
        <GigForm values={values} onChange={handleChange} errors={errors ?? {}} />
      </View>
    </Section>
  );
}

function SectionLabelSection() {
  return (
    <Section title="SectionLabel — GL-130">
      <SectionLabel>Skills</SectionLabel>
    </Section>
  );
}

function ScreenHeaderSection() {
  return (
    <Section title="ScreenHeader — GL-131">
      <Text className="text-sm text-text-secondary">Default title, avatar right slot</Text>
      <View className="overflow-hidden rounded-lg border border-border bg-paper">
        <ScreenHeader title="Find a gig" rightSlot={<Avatar name="Ashan Perera" size="sm" />} />
      </View>

      <Text className="mt-3 text-sm text-text-secondary">Small title, back button</Text>
      <View className="overflow-hidden rounded-lg border border-border bg-paper">
        <ScreenHeader title="Work experience" small onBack={() => {}} />
      </View>

      <Text className="mt-3 text-sm text-text-secondary">
        Small title, back button, text action right slot
      </Text>
      <View className="overflow-hidden rounded-lg border border-border bg-paper">
        <ScreenHeader
          title="Work experience"
          small
          onBack={() => {}}
          rightSlot={<Text className="text-[14px] font-bold text-signal">+ Add</Text>}
        />
      </View>
    </Section>
  );
}

function HeroHeaderSection() {
  const [stickyVisible, setStickyVisible] = useState(false);

  return (
    <Section title="HeroHeader — GL-131">
      <Text className="text-sm text-text-secondary">
        Scroll inside the box below: the ink hero scrolls away with the content and the white sticky
        bar takes over, exactly as a screen composing HeroHeader/HeroStickyBar/HeroSheet would wire
        it.
      </Text>
      <View className="h-[420px] overflow-hidden rounded-lg border border-border">
        <ScrollView
          onScroll={(event) => setStickyVisible(event.nativeEvent.contentOffset.y > 160)}
          scrollEventThrottle={16}
        >
          <HeroHeader>
            <Text className="text-center font-display text-[22px] text-paper">Ashan Perera</Text>
            <Text className="mt-1 text-center text-[13px] text-muted-dark">
              Job Seeker · Colombo
            </Text>
          </HeroHeader>
          <HeroSheet>
            <View className="gap-3 px-5 py-6">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                <View key={row} className="h-12 rounded-md bg-haze" />
              ))}
            </View>
          </HeroSheet>
        </ScrollView>

        <View className="absolute left-0 right-0 top-0">
          <HeroStickyBar title="Ashan Perera" visible={stickyVisible} onBack={() => {}} />
        </View>
      </View>
    </Section>
  );
}

function SegmentedControlSection() {
  const [status, setStatus] = useState('all');

  return (
    <Section title="SegmentedControl — GL-132">
      <SegmentedControl
        options={[
          { value: 'all', label: 'All 7' },
          { value: 'live', label: 'Live 3' },
          { value: 'decided', label: 'Decided 4' },
        ]}
        value={status}
        onChange={setStatus}
      />
    </Section>
  );
}

function ConfirmDialogSection() {
  const [openDialog, setOpenDialog] = useState(null);

  return (
    <Section title="ConfirmDialog — GL-132">
      <Button variant="small" fullWidth={false} onPress={() => setOpenDialog('default')}>
        Open — default
      </Button>
      <Button variant="small" fullWidth={false} onPress={() => setOpenDialog('destructive')}>
        Open — destructive
      </Button>

      <ConfirmDialog
        visible={openDialog === 'default'}
        title="Close this gig?"
        body="Seekers will no longer be able to apply."
        confirmLabel="Close gig"
        cancelLabel="Keep it open"
        onConfirm={() => setOpenDialog(null)}
        onCancel={() => setOpenDialog(null)}
      />
      <ConfirmDialog
        visible={openDialog === 'destructive'}
        destructive
        title="Withdraw this application?"
        body="You're currently shortlisted for this gig."
        confirmLabel="Withdraw"
        cancelLabel="Keep my application"
        onConfirm={() => setOpenDialog(null)}
        onCancel={() => setOpenDialog(null)}
      />
    </Section>
  );
}

function FormattersSection() {
  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const relativeTimeExamples = [
    { label: 'Under a minute', date: new Date(now.getTime() - 30 * 1000) },
    { label: 'Under an hour', date: new Date(now.getTime() - 20 * 60 * 1000) },
    { label: 'Under a day', date: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
    { label: 'Under a week', date: new Date(now.getTime() - 5 * DAY_MS) },
    { label: 'Beyond a week', date: new Date(now.getTime() - 20 * DAY_MS) },
  ];

  const deadlineExamples = [
    { label: 'Past', date: new Date(now.getTime() - DAY_MS) },
    { label: 'Today', date: now },
    { label: 'Tomorrow', date: new Date(now.getTime() + DAY_MS) },
    { label: 'In three days', date: new Date(now.getTime() + 3 * DAY_MS) },
    { label: 'Beyond three days', date: new Date(now.getTime() + 10 * DAY_MS) },
  ];

  return (
    <Section title="Formatters — GL-104">
      <Text className="text-sm font-medium text-text-primary">Pay</Text>
      <Text className="text-sm text-text-secondary">{formatPay(2500, 'per_hour')}</Text>
      <Text className="text-sm text-text-secondary">{formatPay(4500, 'per_day')}</Text>
      <Text className="text-sm text-text-secondary">{formatPay(18000, 'fixed_price')}</Text>

      <Text className="mt-3 text-sm font-medium text-text-primary">Relative time</Text>
      {relativeTimeExamples.map((example) => (
        <Text key={example.label} className="text-sm text-text-secondary">
          {example.label}: {formatRelativeTime(example.date, now)}
        </Text>
      ))}

      <Text className="mt-3 text-sm font-medium text-text-primary">Deadline</Text>
      {deadlineExamples.map((example) => {
        const { label, urgent } = formatDeadline(example.date, now);
        return (
          <Text key={example.label} className="text-sm text-text-secondary">
            {example.label}: {label} ({urgent ? 'urgent' : 'not urgent'})
          </Text>
        );
      })}

      <Text className="mt-3 text-sm font-medium text-text-primary">Location</Text>
      <Text className="text-sm text-text-secondary">{formatLocation({ isRemote: true })}</Text>
      <Text className="text-sm text-text-secondary">
        {formatLocation({ isRemote: false, area: 'Nugegoda', city: 'Colombo' })}
      </Text>
      <Text className="text-sm text-text-secondary">
        {formatLocation({ isRemote: false, city: 'Colombo' })}
      </Text>
    </Section>
  );
}

export default function ComponentDemoScreen() {
  return (
    <Screen scroll>
      <Text className="mb-6 text-2xl font-bold text-text-primary">UI Kit</Text>
      <ScreenSection />
      <DesignTokensSection />
      <TokenSwatchSection />
      <AuthPrimitivesSection />
      <ButtonSection />
      <TextInputSection />
      <CardSection />
      <EmptyStateSection />
      <LoaderSection />
      <BadgeSection />
      <ChipSection />
      <AvatarSection />
      <StarRatingSection />
      <ReviewCardSection />
      <CategoryChipGroupSection />
      <RatingBarsSection />
      <GigFormSection />
      <GigFormRulesSection />
      <SectionLabelSection />
      <ScreenHeaderSection />
      <HeroHeaderSection />
      <SegmentedControlSection />
      <ConfirmDialogSection />
      <FormattersSection />
    </Screen>
  );
}
