import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

// Placeholder body only (GL-384) - this route exists so the admin branch has
// somewhere real to land ahead of the moderation queue API (E5). The actual
// open-reports list (GL-306 criteria 6-11) replaces this body once
// GET /api/admin/reports exists.
export default function ReportsScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Reports" />
      <EmptyState message="Open reports will show here." />
    </Screen>
  );
}
