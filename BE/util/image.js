// Saves a base64-encoded image from GraphQL into the backend images folder.
const fs = require('fs');
const path = require('path');

const MIME_TYPE_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg'
};

const DEFAULT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const getMaxImageSizeBytes = () => {
  const configuredLimit = Number(process.env.IMAGE_FILE_SIZE_LIMIT_BYTES);

  return Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_MAX_IMAGE_SIZE_BYTES;
};

const getBase64ByteSize = rawImageData => {
  const padding = rawImageData.endsWith('==')
    ? 2
    : rawImageData.endsWith('=')
      ? 1
      : 0;

  return Math.floor((rawImageData.length * 3) / 4) - padding;
};

// Verifies that the decoded bytes match the declared PNG or JPEG media type.
const hasExpectedSignature = (buffer, mimeType) => {
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    );
  }

  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
};

const formatMegabytes = bytes => `${Math.floor(bytes / 1024 / 1024)}MB`;

// Validates a data URL, writes it to disk, and returns the public image path.
const saveImageFromBase64 = async imageData => {
  if (!imageData || typeof imageData !== 'string') {
    return '';
  }

  const matches = imageData.match(
    /^data:(image\/png|image\/jpg|image\/jpeg);base64,(.+)$/
  );

  if (!matches) {
    const error = new Error('Invalid image data.');
    error.statusCode = 422;
    throw error;
  }

  const [, mimeType, rawImageData] = matches;
  const maxImageSizeBytes = getMaxImageSizeBytes();
  const imageSizeBytes = getBase64ByteSize(rawImageData);

  if (imageSizeBytes > maxImageSizeBytes) {
    const error = new Error(
      `Image exceeds the maximum size of ${formatMegabytes(maxImageSizeBytes)}.`
    );
    error.statusCode = 413;
    throw error;
  }

  const imageBuffer = Buffer.from(rawImageData, 'base64');

  if (imageBuffer.length !== imageSizeBytes || !hasExpectedSignature(imageBuffer, mimeType)) {
    const error = new Error('Image content does not match its declared type.');
    error.statusCode = 422;
    throw error;
  }

  const fileExtension = MIME_TYPE_TO_EXTENSION[mimeType];
  const fileName = `${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}.${fileExtension}`;
  const imagesDirectory = path.join(__dirname, '..', 'images');
  const filePath = path.join(imagesDirectory, fileName);

  await fs.promises.mkdir(imagesDirectory, { recursive: true });
  await fs.promises.writeFile(filePath, imageBuffer, { flag: 'wx' });

  return `/images/${fileName}`;
};

module.exports = saveImageFromBase64;
