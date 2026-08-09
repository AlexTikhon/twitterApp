const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { LocalImageStorage } = require('../storage/local-image-storage');

const validPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

let imagesDirectory;
let storage;

before(async () => {
  imagesDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'twitter-image-test-'));
  storage = new LocalImageStorage({
    imagesDirectory,
    maxImageSizeBytes: 5 * 1024 * 1024
  });
});

after(async () => {
  await fs.rm(imagesDirectory, { force: true, recursive: true });
});

test('image storage validates signatures and stores managed PNG files', async () => {
  const publicPath = await storage.saveBuffer(validPng, 'image/png');
  const absolutePath = path.join(imagesDirectory, path.basename(publicPath));

  assert.match(publicPath, /^\/images\/[a-zA-Z0-9.-]+\.png$/);
  assert.equal((await fs.stat(absolutePath)).isFile(), true);
  assert.equal(await storage.delete(publicPath), true);
});

test('image storage rejects content that does not match its declared type', async () => {
  await assert.rejects(
    storage.saveBuffer(Buffer.from('hello'), 'image/png'),
    (error) => error.statusCode === 422
  );
});

test('image storage enforces its configured decoded size limit', async () => {
  const limitedStorage = new LocalImageStorage({ imagesDirectory, maxImageSizeBytes: 4 });
  await assert.rejects(
    limitedStorage.saveBuffer(validPng, 'image/png'),
    (error) => error.statusCode === 413
  );
});
