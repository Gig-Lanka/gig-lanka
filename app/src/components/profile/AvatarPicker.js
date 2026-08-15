import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import Avatar from '../ui/Avatar';
import Notice from '../ui/Notice';
import { validateImageFile } from '../../utils/validation';

/**
 * Photo control for the edit-profile screen (GL-152/GL-153) — shows the
 * current photo, or the `Avatar` initials fallback when there is none, with
 * a "Change" control that opens the device image library. Camera capture is
 * not required (docs mockup `#edit-profile-seeker`).
 *
 * The picked asset is checked against the server's own upload rules
 * (docs/api-contract.md §9.1) before `onImageSelected` fires, so an oversize
 * or wrong-type file is caught here rather than costing a round trip.
 * Uploading the asset and persisting it to the profile is the caller's job
 * (GL-153) — this component only picks, validates and hands the asset up.
 * `uploading` and `error` reflect that caller-owned request back onto the
 * control: a spinner over the avatar and the control blocked while it's in
 * flight, and any failure message shown alongside a local validation one.
 */
export default function AvatarPicker({
  uri,
  name,
  square = false,
  disabled = false,
  uploading = false,
  error,
  onImageSelected,
}) {
  const [localError, setLocalError] = useState('');
  const isDisabled = disabled || uploading;

  async function handleChange() {
    if (isDisabled) return;
    setLocalError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setLocalError('Allow photo library access to change your photo.');
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
      setLocalError(validationError);
      return;
    }

    onImageSelected?.(asset);
  }

  const displayError = localError || error;
  const shapeClassName = square ? 'rounded-[24px]' : 'rounded-full';

  return (
    <View>
      <View className="flex-row items-center gap-[14px]">
        <View>
          <Avatar uri={uri} name={name} size="lg" square={square} />
          {uploading ? (
            <View
              className={[
                'absolute inset-0 items-center justify-center bg-ink/40',
                shapeClassName,
              ].join(' ')}
            >
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </View>
        <View>
          <Text className="text-label text-ink">Profile photo</Text>
          <Pressable
            onPress={handleChange}
            disabled={isDisabled}
            className={['mt-2 self-start', isDisabled && 'opacity-40'].filter(Boolean).join(' ')}
          >
            <View className="self-start rounded-full border-[1.5px] border-line bg-haze px-[13px] py-[7px]">
              <Text className="text-[13px] font-semibold text-ink">Change</Text>
            </View>
          </Pressable>
        </View>
      </View>
      {displayError ? (
        <Notice variant="error" className="mt-3">
          {displayError}
        </Notice>
      ) : null}
    </View>
  );
}
