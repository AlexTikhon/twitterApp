const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { test } = require('node:test');

const clearImage = require('../util/file');
const saveImage = require('../util/image');

const validPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('saveImage validates signatures and stores managed PNG files', async (t) => {
  const publicPath = await saveImage(validPng);
  const absolutePath = path.resolve(__dirname, '..', publicPath.replace(/^\/+/, ''));

  t.after(() => clearImage(publicPath));

  assert.match(publicPath, /^\/images\/[a-zA-Z0-9.-]+\.png$/);
  assert.equal((await fs.stat(absolutePath)).isFile(), true);
});

test('saveImage rejects content that does not match its declared type', async () => {
  await assert.rejects(
    saveImage('data:image/png;base64,aGVsbG8='),
    (error) => error.statusCode === 422
  );
});

test('saveImage enforces the configured decoded size limit', async () => {
  const previousLimit = process.env.IMAGE_FILE_SIZE_LIMIT_BYTES;
  process.env.IMAGE_FILE_SIZE_LIMIT_BYTES = '4';

  try {
    await assert.rejects(saveImage(validPng), (error) => error.statusCode === 413);
  } finally {
    if (previousLimit === undefined) {
      delete process.env.IMAGE_FILE_SIZE_LIMIT_BYTES;
    } else {
      process.env.IMAGE_FILE_SIZE_LIMIT_BYTES = previousLimit;
    }
  }
});
