// Upload client - GL-152. `POST /api/uploads` (docs/api-contract.md §9) takes
// multipart form data under the fixed `file` field plus a `folder` purpose;
// the client never talks to Supabase directly, only to this endpoint.
//
// React Native's `FormData` needs a `{ uri, name, type }` object for a file
// entry, not a browser `File`/`Blob` - a mismatch here surfaces as an empty
// upload rather than an error, so all three are always set explicitly from
// the `expo-image-picker` asset.

import client from './client';

/**
 * `POST /api/uploads` - uploads a single image for the given purpose and
 * returns its stored URL (`data.url`, §9.1). `asset` is an
 * `expo-image-picker` result asset; `folder` is one of the server's closed
 * purposes (only `"avatars"` this sprint).
 */
async function uploadImage(asset, folder) {
  const mimeType = asset.mimeType || 'image/jpeg';
  const extension = mimeType.split('/')[1] || 'jpg';

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || `photo.${extension}`,
    type: mimeType,
  });
  formData.append('folder', folder);

  const response = await client.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data.url;
}

export default {
  uploadImage,
};
