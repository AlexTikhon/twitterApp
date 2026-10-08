import { afterEach, describe, expect, it, vi } from 'vitest';

import { uploadImage } from './upload';

const file = new File(['image'], 'photo.png', { type: 'image/png' });
const respondWith = (body: BodyInit | null, status = 200) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));

describe('uploadImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the upload id of a well-formed response', async () => {
    respondWith(JSON.stringify({ uploadId: 'upload-id' }));

    await expect(uploadImage(file)).resolves.toBe('upload-id');
  });

  it.each([
    ['a missing upload id', JSON.stringify({})],
    ['a non-string upload id', JSON.stringify({ uploadId: 42 })],
    ['an empty upload id', JSON.stringify({ uploadId: '' })],
    ['a JSON null body', 'null'],
    ['an array body', '[]'],
    ['a non-JSON body', '<html>Bad gateway</html>']
  ])('rejects a successful response with %s', async (_label, body) => {
    respondWith(body);

    await expect(uploadImage(file)).rejects.toThrow(
      'Image upload returned an unexpected response.'
    );
  });

  it('surfaces the server message and status of a failed upload', async () => {
    respondWith(JSON.stringify({ message: 'Image is too large.' }), 413);

    await expect(uploadImage(file)).rejects.toMatchObject({
      message: 'Image is too large.',
      statusCode: 413
    });
  });

  it('reports a generic failure when an error response is not JSON', async () => {
    respondWith('<html>Bad gateway</html>', 502);

    await expect(uploadImage(file)).rejects.toMatchObject({
      message: 'Image upload failed.',
      statusCode: 502
    });
  });
});
