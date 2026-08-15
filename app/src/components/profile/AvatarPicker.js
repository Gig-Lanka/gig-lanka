import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, Text, View } from 'react-native';

import Avatar from '../ui/Avatar';
import Notice from '../ui/Notice';
import { validateImageFile } from '../../utils/validation';

/**
 * Photo control for the edit-profile screen (GL-152) — shows the current
 * photo, or the `Avatar` initials fallback when there is none, with a
 * "Change" control that opens the device image library. Camera capture is
 * not required (docs mockup `#edit-profile-seeker`).
 *
 * The picked asset is checked against the server's own upload rules
 * (docs/api-contract.md §9.1) before `onImageSelected` fires, so an oversize
 * or wrong-type file is caught here rather than costing a round trip.
 * Actually uploading the asset and persisting it to the profile is GL-153's
 * job — `onImageSelected` just hands the validated asset up.
 */
export default function AvatarPicker({
  uri,
  name,
  square = false,
  disabled = false,
  onImageSelected,
}) {
  const [error, setError] = useState('');

  async function handleChange() {
    if (disabled) return;
    setError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo library access to change your photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const validationError = validateImageFile(asset);
    if (validationError) {
      setError(validationError);
      return;
    }

    onImageSelected?.(asset);
  }

  return (
    <View>
      <View className="flex-row items-center gap-[14px]">
        <Avatar uri={uri} name={name} size="lg" square={square} />
        <View>
          <Text className="text-label text-ink">Profile photo</Text>
          <Pressable
            onPress={handleChange}
            disabled={disabled}
            className={['mt-2 self-start', disabled && 'opacity-40'].filter(Boolean).join(' ')}
          >
            <View className="self-start rounded-full border-[1.5px] border-line bg-haze px-[13px] py-[7px]">
              <Text className="text-[13px] font-semibold text-ink">Change</Text>
            </View>
          </Pressable>
        </View>
      </View>
      {error ? (
        <Notice variant="error" className="mt-3">
          {error}
        </Notice>
      ) : null}
    </View>
  );
}
