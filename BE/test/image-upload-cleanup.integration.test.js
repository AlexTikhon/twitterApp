const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, afterEach, before, beforeEach, test } = require('node:test');

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const { loadConfig } = require('../config');
const { createDependencies } = require('../dependencies');
const ImageUpload = require('../models/image-upload');
const Post = require('../models/post');
const User = require('../models/user');

const UPLOAD_MAX_AGE_MS = 400;
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const models = [ImageUpload, Post, User];

let mongoServer;
let imagesDirectory;
let dependencies;
let user;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fileExists = (imageUrl) =>
  fs.access(dependencies.imageStorage.resolve(imageUrl)).then(
    () => true,
    () => false
  );

const uploadImage = async () => {
  const { uploadId } = await dependencies.services.imageUploads.upload(user._id.toString(), {
    buffer: VALID_PNG,
    mimetype: 'image/png'
  });
  const record = await ImageUpload.findById(uploadId);
  return { uploadId, imageUrl: record.imageUrl, expiresAt: record.expiresAt };
};

const sleepUntil = (date) => sleep(Math.max(0, date.getTime() - Date.now()) + 25);

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(mongoServer.getUri());
  imagesDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'twitter-cleanup-test-'));
  const baseConfig = loadConfig({
    MONGODB_URI: mongoServer.getUri(),
    JWT_SECRET: 'cleanup-integration-test-secret-with-sufficient-length',
    NODE_ENV: 'test'
  });
  dependencies = createDependencies({
    ...baseConfig,
    storage: { ...baseConfig.storage, imagesDirectory, uploadMaxAgeMs: UPLOAD_MAX_AGE_MS }
  });
});

beforeEach(async () => {
  // Collections must pre-exist: transactions cannot implicitly create them.
  await Promise.all(models.map((model) => model.createCollection()));
  await Promise.all(models.map((model) => model.deleteMany({})));
  user = await User.create({ email: 'owner@example.com', name: 'Owner', password: 'hashed' });
});

afterEach(async () => {
  await fs.rm(imagesDirectory, { recursive: true, force: true });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await fs.rm(imagesDirectory, { recursive: true, force: true });
});

test('cleanup cannot delete the file of an upload consumed by a still-open transaction', async () => {
  const { imageUploads } = dependencies.services;
  const { uploadId, imageUrl, expiresAt } = await uploadImage();

  const session = await mongoose.connection.startSession();
  session.startTransaction();
  try {
    // Consumption happens before expiry but is not yet committed.
    const consumed = await imageUploads.consume(uploadId, user._id.toString(), session);
    assert.equal(consumed.imageUrl, imageUrl);
    await sleepUntil(expiresAt);

    // Cleanup now sees the previously committed, unconsumed, expired record.
    const cleanup = imageUploads.cleanupExpired();
    await sleep(300);
    assert.equal(
      await fileExists(imageUrl),
      true,
      'file must survive while the claim is contended'
    );

    await dependencies.repositories.post.create(
      {
        content: 'Post referencing the consumed upload.',
        imageUrl: consumed.imageUrl,
        creator: user._id
      },
      { session }
    );
    await session.commitTransaction();
    await cleanup;
  } finally {
    await session.endSession();
  }

  const post = await Post.findOne({ creator: user._id });
  assert.equal(post.imageUrl, imageUrl);
  assert.equal(await fileExists(imageUrl), true);
  const record = await ImageUpload.findById(uploadId);
  assert.ok(record.consumedAt, 'consumed metadata remains for post-commit release');
});

test('cleanup of an aborted consumption removes the expired file and its metadata', async () => {
  const { imageUploads } = dependencies.services;
  const { uploadId, imageUrl, expiresAt } = await uploadImage();

  const session = await mongoose.connection.startSession();
  session.startTransaction();
  try {
    await imageUploads.consume(uploadId, user._id.toString(), session);
    await sleepUntil(expiresAt);
    const cleanup = imageUploads.cleanupExpired();
    await sleep(100);
    await session.abortTransaction();
    await cleanup;
  } finally {
    await session.endSession();
  }

  assert.equal(await fileExists(imageUrl), false);
  assert.equal(await ImageUpload.countDocuments({ _id: uploadId }), 0);
});

test('failed file deletion keeps retryable metadata and a later cleanup completes it', async () => {
  const { imageUploads } = dependencies.services;
  const { uploadId, imageUrl, expiresAt } = await uploadImage();
  await sleepUntil(expiresAt);

  const originalDelete = dependencies.imageStorage.delete;
  dependencies.imageStorage.delete = async () => false;
  try {
    await imageUploads.cleanupExpired();
  } finally {
    dependencies.imageStorage.delete = originalDelete;
  }
  assert.equal(await ImageUpload.countDocuments({ _id: uploadId }), 1);
  assert.equal(await fileExists(imageUrl), true);

  await imageUploads.cleanupExpired();
  assert.equal(await fileExists(imageUrl), false);
  assert.equal(await ImageUpload.countDocuments({ _id: uploadId }), 0);

  // Running cleanup again, or with the file already gone, is harmless.
  await imageUploads.cleanupExpired();
});

test('cleanup is idempotent when the file is already missing', async () => {
  const { imageUploads } = dependencies.services;
  const { uploadId, imageUrl, expiresAt } = await uploadImage();
  await fs.unlink(dependencies.imageStorage.resolve(imageUrl));
  await sleepUntil(expiresAt);

  await imageUploads.cleanupExpired();
  assert.equal(await ImageUpload.countDocuments({ _id: uploadId }), 0);
});

test('an upload claimed for cleanup can no longer be consumed', async () => {
  const { imageUploads } = dependencies.services;
  const { uploadId } = await uploadImage();
  await ImageUpload.updateOne({ _id: uploadId }, { $set: { cleanupClaimedAt: new Date() } });

  await assert.rejects(imageUploads.consume(uploadId, user._id.toString()), {
    message: 'Image upload is invalid, expired, or already used.'
  });
});

test('a rolled back consumption leaves the upload usable by its owner', async () => {
  const { imageUploads } = dependencies.services;
  const { uploadId } = await uploadImage();

  const session = await mongoose.connection.startSession();
  try {
    session.startTransaction();
    await imageUploads.consume(uploadId, user._id.toString(), session);
    await session.abortTransaction();
  } finally {
    await session.endSession();
  }

  await assert.rejects(imageUploads.consume(uploadId, '507f1f77bcf86cd799439099'), {
    message: 'Image upload is invalid, expired, or already used.'
  });
  const consumed = await imageUploads.consume(uploadId, user._id.toString());
  assert.ok(consumed.consumedAt);
});
