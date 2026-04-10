// Saves a base64-encoded image from GraphQL into the backend images folder.
const fs = require('fs');
const path = require('path');

const MIME_TYPE_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg'
};

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
