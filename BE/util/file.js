// Deletes a stored image file when a post is updated or removed.
const fs = require('fs');
const path = require('path');

module.exports = filePath => {
  if (!filePath) {
    return;
  }

  const normalizedPath = filePath.replace(/^\/+/, '');
  const absolutePath = path.join(__dirname, '..', normalizedPath);

  fs.unlink(absolutePath, err => {
    if (err && err.code !== 'ENOENT') {
      console.error('Failed to delete file:', err);
    }
  });
};
