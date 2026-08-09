const assert = require('node:assert/strict');
const { test } = require('node:test');

const { PostService } = require('../services/post-service');

const postInput = {
  title: 'Service post',
  content: 'Created by a post service unit test.',
  imageUploadId: '507f1f77bcf86cd799439013'
};

const createService = (overrides = {}) =>
  new PostService({
    postRepository: {
      create: async () => ({ _id: 'post-id' }),
      ...overrides.postRepository
    },
    userRepository: {
      findById: async () => ({ _id: 'user-id' }),
      ...overrides.userRepository
    },
    imageStorage: {
      delete: async () => true,
      ...overrides.imageStorage
    },
    imageUploadService: {
      consume: async () => ({ imageUrl: '/images/uploaded.png' }),
      releaseMetadata: async () => {},
      ...overrides.imageUploadService
    },
    postRealtime: {
      emit: async () => {},
      ...overrides.postRealtime
    },
    runInTransaction: overrides.runInTransaction || ((work) => work({ id: 'session' })),
    pagination: { defaultPageSize: 2, maxPageSize: 20 }
  });

test('post creation leaves upload metadata reusable when the transaction rolls back', async () => {
  const releasedUploads = [];
  const databaseError = new Error('database write failed');
  const service = createService({
    postRepository: {
      create: async () => {
        throw databaseError;
      }
    },
    imageUploadService: {
      releaseMetadata: async (uploadId) => releasedUploads.push(uploadId)
    }
  });

  await assert.rejects(service.create('507f1f77bcf86cd799439011', postInput), databaseError);
  assert.deepEqual(releasedUploads, []);
});

test('post creation releases upload metadata and emits realtime after commit', async () => {
  const events = [];
  const service = createService({
    postRepository: {
      create: async () => {
        events.push('database-write');
        return { _id: 'post-id' };
      }
    },
    runInTransaction: async (work) => {
      const result = await work({ id: 'session' });
      events.push('commit');
      return result;
    },
    imageUploadService: {
      releaseMetadata: async () => events.push('metadata-release')
    },
    postRealtime: {
      emit: async () => events.push('realtime')
    }
  });

  await service.create('507f1f77bcf86cd799439011', postInput);
  assert.deepEqual(events, ['database-write', 'commit', 'metadata-release', 'realtime']);
});

test('post update preserves the current image when the transaction rolls back', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const deletedImages = [];
  const databaseError = new Error('database update failed');
  const existingPost = {
    _id: 'post-id',
    title: 'Existing title',
    content: 'Existing content',
    imageUrl: '/images/current.png',
    creator: { toString: () => userId }
  };
  const service = createService({
    postRepository: {
      findById: async () => existingPost,
      save: async () => {
        throw databaseError;
      }
    },
    imageStorage: {
      delete: async (imageUrl) => deletedImages.push(imageUrl)
    }
  });

  await assert.rejects(
    service.update(userId, '507f1f77bcf86cd799439012', postInput),
    databaseError
  );
  assert.deepEqual(deletedImages, []);
});
