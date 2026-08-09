const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { after, before, test } = require('node:test');

const { LocalImageStorage } = require('../storage/local-image-storage');

let imagesDirectory;
let storage;

before(async () => {
  imagesDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'twitter-file-test-'));
  storage = new LocalImageStorage({
    imagesDirectory,
    maxImageSizeBytes: 5 * 1024 * 1024
  });
});

after(async () => {
  await fs.rm(imagesDirectory, { force: true, recursive: true });
});

test('image storage rejects traversal paths without touching outside files', async (t) => {
  const sentinelName = `protected-${randomUUID()}.txt`;
  const sentinelPath = path.join(path.dirname(imagesDirectory), sentinelName);
  const sentinelContents = Buffer.from('must remain unchanged');

  await fs.writeFile(sentinelPath, sentinelContents);
  t.after(() => fs.rm(sentinelPath, { force: true }));

  assert.equal(await storage.delete(`/images/../${sentinelName}`), false);
  assert.deepEqual(await fs.readFile(sentinelPath), sentinelContents);
});

test('image storage removes a managed image and is idempotent', async () => {
  const fileName = `test-${randomUUID()}.png`;
  const absolutePath = path.join(imagesDirectory, fileName);

  await fs.writeFile(absolutePath, 'test');

  assert.equal(await storage.delete(`/images/${fileName}`), true);
  assert.equal(await storage.delete(`/images/${fileName}`), true);
});
