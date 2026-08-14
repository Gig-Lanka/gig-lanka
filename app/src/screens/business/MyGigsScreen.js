import { useEffect, useMemo, useState } from 'react';
import { FlatList } from 'react-native';

import gigApi from '../../api/gigApi';
import BusinessGigCard from '../../components/gig/BusinessGigCard';
import GigStatusFilter from '../../components/gig/GigStatusFilter';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

export default function MyGigsScreen() {
  const [gigs, setGigs] = useState([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGigs() {
      setLoading(true);
      setError(null);
      try {
        const { gigs: fetchedGigs } = await gigApi.getMyGigs();
        if (!cancelled) {
          setGigs(fetchedGigs);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load your gigs.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadGigs();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredGigs = useMemo(() => gigs.filter((gig) => gig.status === status), [gigs, status]);

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen>
      <ScreenHeader title="My Gigs" />
      <GigStatusFilter value={status} onChange={setStatus} className="mb-4" />

      {error ? (
        <Notice variant="error">{error}</Notice>
      ) : (
        <FlatList
          data={filteredGigs}
          keyExtractor={(gig) => gig.id}
          renderItem={({ item }) => <BusinessGigCard gig={item} />}
          contentContainerClassName="gap-3 pb-6"
          ListEmptyComponent={<EmptyState message="No gigs with this status." />}
        />
      )}
    </Screen>
  );
}
