// Deletes only image files managed by this application.
const fs = require('fs/promises');
const path = require('path');

const imagesDirectory = path.resolve(__dirname, '..', 'images');
const storedImagePathPattern = /^\/images\/[a-zA-Z0-9._-]+$/;

// Resolves a public image URL without allowing traversal outside /images.
const resolveStoredImagePath = publicPath => {
  if (typeof publicPath !== 'string' || !storedImagePathPattern.test(publicPath)) {
    return null;
  }

  const absolutePath = path.resolve(imagesDirectory, path.basename(publicPath));

  return path.dirname(absolutePath) === imagesDirectory ? absolutePath : null;
};

// Removes a stored image while treating missing and legacy-invalid paths safely.
module.exports = async publicPath => {
  const absolutePath = resolveStoredImagePath(publicPath);

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
};
