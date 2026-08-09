import { useState } from 'react';
import { Text, View } from 'react-native';

import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ProgressPips from '../../components/ui/ProgressPips';
import RoleStrip from '../../components/ui/RoleStrip';
import Screen from '../../components/ui/Screen';
import TextInput from '../../components/ui/TextInput';

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

export default function ComponentDemoScreen() {
  return (
    <Screen scroll>
      <Text className="mb-6 text-2xl font-bold text-text-primary">UI Kit</Text>
      <ScreenSection />
      <DesignTokensSection />
      <AuthPrimitivesSection />
      <ButtonSection />
      <TextInputSection />
      <CardSection />
      <EmptyStateSection />
      <LoaderSection />
    </Screen>
  );
}
