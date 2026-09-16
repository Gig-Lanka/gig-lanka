import { useNavigation } from '@react-navigation/native';

import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

// Placeholder pending the saved gigs API (E3) and GigCard star control -
// this only wires the tab and empty state so SeekerTabs has somewhere to
// route to; the list, count line and optimistic toggle land with that story.
export default function SavedGigsScreen() {
  const navigation = useNavigation();

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Saved" />
      <EmptyState
        message="Tap the star on any gig and it waits for you here."
        actionLabel="Browse gigs"
        onAction={() => navigation.navigate('Browse')}
      />
    </Screen>
  );
}
