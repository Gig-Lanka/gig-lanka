import { useState } from 'react';
import { Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
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
      <Section title="Button — variants">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="danger">Danger</Button>
      </Section>

      <Section title="Button — sizes">
        <Button size="small">Small</Button>
        <Button size="medium">Medium</Button>
        <Button size="large">Large</Button>
      </Section>

      <Section title="Button — states">
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button fullWidth>Full width</Button>
      </Section>
    </>
  );
}

function TextInputSection() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');

  return (
    <Section title="TextInput">
      <TextInput
        label="Email"
        placeholder="you@example.com"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput label="Password" placeholder="Password" secureTextEntry />
      <TextInput
        label="Amount"
        placeholder="0"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <TextInput label="With error" placeholder="Username" error="This field is required" />
      <TextInput label="Disabled" placeholder="Can't touch this" disabled />
    </Section>
  );
}

function CardSection() {
  return (
    <Section title="Card">
      <Card>
        <Text className="text-base font-medium text-text-primary">Card title</Text>
        <Text className="mt-1 text-sm text-text-secondary">
          Consistent padding, background, and border radius for list items and content blocks.
        </Text>
      </Card>
    </Section>
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
      <ButtonSection />
      <TextInputSection />
      <CardSection />
      <EmptyStateSection />
      <LoaderSection />
    </Screen>
  );
}
