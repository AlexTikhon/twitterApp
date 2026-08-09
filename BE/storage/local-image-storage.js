const fs = require('node:fs/promises');
const path = require('node:path');

const { createError } = require('../domain/errors');

const MIME_TYPE_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg'
};
const STORED_IMAGE_PATH_PATTERN = /^\/images\/[a-zA-Z0-9._-]+$/;

const hasExpectedSignature = (buffer, mimeType) => {
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }

  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
};

const formatMegabytes = (bytes) => `${Math.floor(bytes / 1024 / 1024)}MB`;

class LocalImageStorage {
  constructor({ imagesDirectory, maxImageSizeBytes }) {
    this.imagesDirectory = path.resolve(imagesDirectory);
    this.maxImageSizeBytes = maxImageSizeBytes;
  }

  resolve(publicPath) {
    if (typeof publicPath !== 'string' || !STORED_IMAGE_PATH_PATTERN.test(publicPath)) {
      return null;
    }

    const absolutePath = path.resolve(this.imagesDirectory, path.basename(publicPath));
    return path.dirname(absolutePath) === this.imagesDirectory ? absolutePath : null;
  }

  async saveBuffer(imageBuffer, mimeType) {
    if (!Buffer.isBuffer(imageBuffer) || !MIME_TYPE_TO_EXTENSION[mimeType]) {
      throw createError('Invalid image data.', 422);
    }
    if (imageBuffer.length > this.maxImageSizeBytes) {
      throw createError(
        `Image exceeds the maximum size of ${formatMegabytes(this.maxImageSizeBytes)}.`,
        413
      );
    }
    if (!hasExpectedSignature(imageBuffer, mimeType)) {
      throw createError('Image content does not match its declared type.', 422);
    }

    const extension = MIME_TYPE_TO_EXTENSION[mimeType];
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;
    const filePath = path.join(this.imagesDirectory, fileName);

    await fs.mkdir(this.imagesDirectory, { recursive: true });
    await fs.writeFile(filePath, imageBuffer, { flag: 'wx' });
    return `/images/${fileName}`;
  }

  async delete(publicPath) {
    const absolutePath = this.resolve(publicPath);
    if (!absolutePath) {
      console.warn('Skipped deletion of an invalid stored image path.');
      return false;
    }

    try {
      await fs.unlink(absolutePath);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to delete stored image:', error);
      }

      return error.code === 'ENOENT';
    }
  }
}

module.exports = { LocalImageStorage };
