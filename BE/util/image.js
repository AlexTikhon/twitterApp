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

  const fileExtension = MIME_TYPE_TO_EXTENSION[mimeType];
  const fileName = `${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}.${fileExtension}`;
  const imagesDirectory = path.join(__dirname, '..', 'images');
  const filePath = path.join(imagesDirectory, fileName);

  await fs.promises.mkdir(imagesDirectory, { recursive: true });
  await fs.promises.writeFile(filePath, rawImageData, 'base64');

  return `/images/${fileName}`;
};

module.exports = saveImageFromBase64;
