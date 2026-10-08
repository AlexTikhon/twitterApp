import { IMAGE_UPLOAD_URL } from '../config';
import { getSession } from '../session';

type UploadError = Error & { statusCode?: number };

const createUploadError = (message: string, statusCode: number) => {
  const error = new Error(message) as UploadError;
  error.statusCode = statusCode;
  return error;
};

const readJsonObject = async (response: Response): Promise<Record<string, unknown> | null> => {
  try {
    const payload: unknown = await response.json();
    return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  const token = getSession()?.token;

  const response = await fetch(IMAGE_UPLOAD_URL, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  const payload = await readJsonObject(response);

  if (!response.ok) {
    throw createUploadError(
      typeof payload?.message === 'string' && payload.message
        ? payload.message
        : 'Image upload failed.',
      response.status
    );
  }

  if (typeof payload?.uploadId !== 'string' || payload.uploadId === '') {
    throw createUploadError('Image upload returned an unexpected response.', response.status);
  }

  return payload.uploadId;
};
