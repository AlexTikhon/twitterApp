import { IMAGE_UPLOAD_URL } from '../config';
import type { GraphqlRequestError } from './graphql';

type ImageUploadResponse = {
  uploadId: string;
};

export const uploadImage = async (file: File, token?: string | null): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(IMAGE_UPLOAD_URL, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  const payload = (await response.json()) as Partial<ImageUploadResponse> & {
    message?: string;
  };

  if (!response.ok || !payload.uploadId) {
    const error = new Error(payload.message || 'Image upload failed.') as GraphqlRequestError;
    error.statusCode = response.status;
    throw error;
  }

  return payload.uploadId;
};
