const { randomUUID } = require('node:crypto');

const { createError } = require('../domain/errors');
const { validateObjectId } = require('../domain/validation');

// A crashed cleanup's claim is retried after this long.
const CLEANUP_CLAIM_LEASE_MS = 5 * 60 * 1000;

class ImageUploadService {
  constructor({ imageUploadRepository, imageStorage, uploadMaxAgeMs, logger }) {
    this.imageUploadRepository = imageUploadRepository;
    this.imageStorage = imageStorage;
    this.uploadMaxAgeMs = uploadMaxAgeMs;
    this.logger = logger;
  }

  async upload(userId, file) {
    if (!file?.buffer || !file.mimetype) {
      throw createError('No image provided.', 422);
    }

    await this.cleanupExpired();
    const imageUrl = await this.imageStorage.saveBuffer(file.buffer, file.mimetype);

    try {
      const upload = await this.imageUploadRepository.create({
        imageUrl,
        owner: userId,
        expiresAt: new Date(Date.now() + this.uploadMaxAgeMs)
      });

      return { uploadId: upload._id.toString() };
    } catch (error) {
      await this.imageStorage.delete(imageUrl);
      throw error;
    }
  }

  async consume(uploadId, userId, session) {
    validateObjectId(uploadId, 'image upload id');
    const upload = await this.imageUploadRepository.consume(uploadId, userId, new Date(), {
      session
    });

    if (!upload) {
      throw createError('Image upload is invalid, expired, or already used.', 422);
    }

    return upload;
  }

  async releaseMetadata(uploadId) {
    try {
      if (uploadId) {
        await this.imageUploadRepository.deleteById(uploadId);
      }
    } catch (error) {
      this.logger?.error(
        { err: error, uploadId },
        'Failed to remove consumed image upload metadata'
      );
    }
  }

  async cleanupExpired() {
    const token = randomUUID();
    const claimedUploads = await this.imageUploadRepository.claimExpired(new Date(), {
      token,
      leaseMs: CLEANUP_CLAIM_LEASE_MS
    });
    if (claimedUploads.length === 0) {
      return;
    }

    const deletionResults = await Promise.all(
      claimedUploads.map(async (upload) => ({
        id: upload._id,
        deleted: await this.imageStorage.delete(upload.imageUrl)
      }))
    );
    const deletedIds = deletionResults
      .filter((result) => result.deleted)
      .map((result) => result.id);
    const failedIds = deletionResults
      .filter((result) => !result.deleted)
      .map((result) => result.id);

    if (deletedIds.length > 0) {
      await this.imageUploadRepository.deleteClaimed(deletedIds, token);
    }
    // Keep metadata for uploads whose file could not be removed so a later cleanup retries them.
    if (failedIds.length > 0) {
      await this.imageUploadRepository.releaseClaim(failedIds, token);
    }
  }
}

module.exports = { ImageUploadService };
