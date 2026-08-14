import { IMAGE_UPLOAD_URL } from '../config';
import { getSession } from '../session';

type ImageUploadResponse = {
  uploadId: string;
};

type UploadError = Error & { statusCode?: number };

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  const token = getSession()?.token;

  const response = await fetch(IMAGE_UPLOAD_URL, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  const payload = (await response.json()) as Partial<ImageUploadResponse> & {
    message?: string;
  };

  if (!response.ok || !payload.uploadId) {
    const error = new Error(payload.message || 'Image upload failed.') as UploadError;
    error.statusCode = response.status;
    throw error;
  }

  return payload.uploadId;
};
