import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { profileApi } from '../../api';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import TextInput from '../../components/ui/TextInput';
import AvatarPicker from '../../components/profile/AvatarPicker';
import SkillsEditor from '../../components/profile/SkillsEditor';
import useAuth from '../../hooks/useAuth';
import { PROFILE_BIO_MAX_LENGTH, validateEditProfileForm } from '../../utils/validation';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

// Fields this form doesn't show but must still send — PUT replaces the
// profile in full (docs/api-contract.md §8.4), so leaving these out of the
// payload would clear them. `photo` is GL-114's field, `workExperience`
// and `education` are GL-113's; none of the three are edited here.
//
// Seeker-only server-side: a business's own GET /me still returns
// `workExperience: []` / `education: []` as schema defaults, but sending
// either back — even empty — is rejected with "is not a field on a
// business profile" (§8.4). So business only passes through `photo`.
const PASSTHROUGH_FIELDS_BY_ROLE = {
  seeker: ['photo', 'workExperience', 'education'],
  business: ['photo'],
};

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const isBusiness = user?.role === 'business';

  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const [passthrough, setPassthrough] = useState({});
  // Local preview of a freshly picked photo — GL-152 only picks and
  // validates the file. Actually uploading it and persisting the URL onto
  // the profile (so it survives navigating away) is GL-153.
  const [pickedPhotoUri, setPickedPhotoUri] = useState(null);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [skills, setSkills] = useState([]);
  const [category, setCategory] = useState('');

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Refetches every time this screen gains focus, not just on mount — the
  // form is opened fresh from the view screen each time, and a stale copy
  // here would mean re-editing values that already changed.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProfile() {
        try {
          const data = await profileApi.getMyProfile();
          if (cancelled) return;

          const passthroughFields = isBusiness
            ? PASSTHROUGH_FIELDS_BY_ROLE.business
            : PASSTHROUGH_FIELDS_BY_ROLE.seeker;
          setPassthrough(
            Object.fromEntries(passthroughFields.map((field) => [field, data[field]])),
          );
          setName(data.name ?? '');
          setBio(data.bio ?? '');
          setCity(data.city ?? '');
          setSkills(data.skills ?? []);
          setCategory(data.category ?? '');
          setPickedPhotoUri(null);
          setErrors({});
          setFormError('');
          setStatus(STATUS.READY);
        } catch {
          if (!cancelled) setStatus(STATUS.ERROR);
        }
      }

      setStatus(STATUS.LOADING);
      loadProfile();

      return () => {
        cancelled = true;
      };
      // reloadToken isn't read above; bumping it changes this callback's
      // identity, which is what makes useFocusEffect refetch on Retry
      // while the screen is already focused.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadToken, isBusiness]),
  );

  const handleSave = async () => {
    const trimmedName = name.trim();
    const validationErrors = validateEditProfileForm({ name: trimmedName, bio });
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length > 0) return;

    const roleFields = isBusiness ? { category } : { skills };
    const knownFields = isBusiness
      ? ['name', 'bio', 'city', 'category']
      : ['name', 'bio', 'city', 'skills'];

    setSubmitting(true);
    try {
      await profileApi.updateMyProfile({
        ...passthrough,
        name: trimmedName,
        bio,
        city,
        ...roleFields,
      });
      navigation.goBack();
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        const unmatched = [];
        apiError.errors.forEach(({ field, message }) => {
          if (knownFields.includes(field)) {
            fieldErrors[field] = message;
          } else {
            unmatched.push(message);
          }
        });
        setErrors(fieldErrors);
        if (unmatched.length > 0) setFormError(unmatched.join(' '));
      } else {
        setFormError(apiError?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.ERROR) {
    return (
      <EmptyState
        className="bg-paper"
        message="We couldn't load your profile."
        actionLabel="Retry"
        onAction={() => setReloadToken((token) => token + 1)}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader
        title={isBusiness ? 'Edit business' : 'Edit profile'}
        small
        onBack={submitting ? undefined : () => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-[22px] pb-6"
        keyboardShouldPersistTaps="handled"
      >
        <AvatarPicker
          uri={pickedPhotoUri || passthrough.photo}
          name={name}
          square={isBusiness}
          disabled={submitting}
          onImageSelected={(asset) => setPickedPhotoUri(asset.uri)}
        />

        <TextInput
          label={isBusiness ? 'Business name' : 'Display name'}
          placeholder={isBusiness ? 'Your business name' : 'Your name'}
          value={name}
          onChangeText={setName}
          error={errors.name}
          disabled={submitting}
          containerClassName="mt-5"
        />

        {isBusiness ? (
          <TextInput
            label="Category"
            placeholder="e.g. Café, Retail, Tutoring"
            value={category}
            onChangeText={setCategory}
            error={errors.category}
            disabled={submitting}
          />
        ) : null}

        <TextInput
          label={isBusiness ? 'Description' : 'Bio'}
          placeholder={isBusiness ? 'What does your business do?' : 'Tell people about yourself'}
          value={bio}
          onChangeText={setBio}
          error={errors.bio}
          hint={errors.bio ? undefined : `${bio.length} / ${PROFILE_BIO_MAX_LENGTH}`}
          disabled={submitting}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="h-[110px] pt-3"
        />

        <TextInput
          label="City"
          placeholder="e.g. Colombo"
          value={city}
          onChangeText={setCity}
          error={errors.city}
          hint={
            isBusiness && !errors.city
              ? "Students search by city, so use the area they'd travel to — not a full address."
              : undefined
          }
          disabled={submitting}
        />

        {!isBusiness ? (
          <View className="mb-4">
            <Text className="mb-2 text-label text-ink">Skills</Text>
            <SkillsEditor skills={skills} onChange={setSkills} />
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t border-line px-[22px] pb-3 pt-3">
        {formError ? (
          <Notice variant="error" className="mb-3">
            {formError}
          </Notice>
        ) : null}
        <Button onPress={handleSave} loading={submitting}>
          Save changes
        </Button>
      </View>
    </SafeAreaView>
  );
}
