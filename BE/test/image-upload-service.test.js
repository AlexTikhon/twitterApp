const assert = require('node:assert/strict');
const { test } = require('node:test');

const { ImageUploadService } = require('../services/image-upload-service');

test('multipart upload removes the file when metadata persistence fails', async () => {
  const deletedImages = [];
  const databaseError = new Error('metadata write failed');
  const service = new ImageUploadService({
    imageUploadRepository: {
      findExpired: async () => [],
      create: async () => {
        throw databaseError;
      }
    },
    imageStorage: {
      saveBuffer: async () => '/images/uploaded.png',
      delete: async (imageUrl) => deletedImages.push(imageUrl)
    },
    uploadMaxAgeMs: 60_000
  });

  await assert.rejects(
    service.upload('507f1f77bcf86cd799439011', {
      buffer: Buffer.from('image'),
      mimetype: 'image/png'
    }),
    databaseError
  );
  assert.deepEqual(deletedImages, ['/images/uploaded.png']);
});

test('expired upload cleanup retains metadata when file deletion fails', async () => {
  const deletedMetadataIds = [];
  const service = new ImageUploadService({
    imageUploadRepository: {
      findExpired: async () => [
        { _id: 'deleted-id', imageUrl: '/images/deleted.png' },
        { _id: 'retry-id', imageUrl: '/images/retry.png' }
      ],
      deleteByIds: async (ids) => deletedMetadataIds.push(...ids)
    },
    imageStorage: {
      delete: async (imageUrl) => imageUrl.endsWith('deleted.png')
    },
    uploadMaxAgeMs: 60_000
  });

  await service.cleanupExpired();
  assert.deepEqual(deletedMetadataIds, ['deleted-id']);
});
