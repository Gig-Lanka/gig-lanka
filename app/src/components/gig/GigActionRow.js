import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import gigApi from '../../api/gigApi';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function GigActionRow({ gig, onGigUpdated, className }) {
  const navigation = useNavigation();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(null);

  async function handleConfirmClose() {
    setClosing(true);
    setCloseError(null);
    try {
      const { gig: updatedGig } = await gigApi.closeGig(gig.id);
      onGigUpdated?.(updatedGig);
      setConfirmVisible(false);
    } catch {
      setCloseError('Could not close this gig. Try again.');
    } finally {
      setClosing(false);
    }
  }

  return (
    <View className={className}>
      <View className="flex-row gap-[10px]">
        <Pressable
          onPress={() => navigation.navigate('EditGig', { gigId: gig.id })}
          className="h-9 flex-1 items-center justify-center rounded-ds-sm border-[1.5px] border-line bg-paper"
        >
          <Text className="text-label text-ink">Edit</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('GigApplicants', { gigId: gig.id })}
          className="h-9 flex-1 items-center justify-center rounded-ds-sm border-[1.5px] border-line bg-paper"
        >
          <Text className="text-label text-ink" numberOfLines={1}>
            Applicants ({gig.applicantCount ?? 0})
          </Text>
        </Pressable>

        {gig.status === 'open' ? (
          <Pressable
            onPress={() => setConfirmVisible(true)}
            className="h-9 flex-1 items-center justify-center rounded-ds-sm border-[1.5px] border-danger bg-paper"
          >
            <Text className="text-label text-danger-ink">Close</Text>
          </Pressable>
        ) : null}
      </View>

      {closeError ? <Text className="mt-2 text-[12.5px] text-danger-ink">{closeError}</Text> : null}

      <ConfirmDialog
        visible={confirmVisible}
        destructive
        title="Close this gig?"
        body="This stops the gig from accepting new applications. People who already applied are unaffected."
        confirmLabel={closing ? 'Closing…' : 'Close gig'}
        cancelLabel="Keep it open"
        onConfirm={handleConfirmClose}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}
