const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

const clearImage = require('../util/file');

const backendDirectory = path.resolve(__dirname, '..');
const imagesDirectory = path.join(backendDirectory, 'images');

test('clearImage rejects traversal paths without touching outside files', async (t) => {
  const sentinelName = `protected-${randomUUID()}.txt`;
  const sentinelPath = path.join(backendDirectory, sentinelName);
  const sentinelContents = Buffer.from('must remain unchanged');

  await fs.writeFile(sentinelPath, sentinelContents);
  t.after(() => fs.rm(sentinelPath, { force: true }));

  assert.equal(await clearImage(`/images/../${sentinelName}`), false);
  assert.deepEqual(await fs.readFile(sentinelPath), sentinelContents);
});

test('clearImage removes a managed image and is idempotent', async () => {
  const fileName = `test-${randomUUID()}.png`;
  const absolutePath = path.join(imagesDirectory, fileName);

  await fs.mkdir(imagesDirectory, { recursive: true });
  await fs.writeFile(absolutePath, 'test');

  assert.equal(await clearImage(`/images/${fileName}`), true);
  assert.equal(await clearImage(`/images/${fileName}`), true);
});
