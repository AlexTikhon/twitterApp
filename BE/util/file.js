// Deletes a stored image file when a post is updated or removed.
const fs = require('fs');
const path = require('path');

// Removes a file relative to the backend root while ignoring already-deleted files.
module.exports = filePath => {
  if (!filePath) {
    return;
  }

  const normalizedPath = filePath.replace(/^\/+/, '');
  const absolutePath = path.join(__dirname, '..', normalizedPath);

  // Reports unexpected filesystem errors without interrupting the request flow.
  fs.unlink(absolutePath, err => {
    if (err && err.code !== 'ENOENT') {
      console.error('Failed to delete file:', err);
    }
  });
};
