const { createError } = require('../domain/errors');
const { validateObjectId } = require('../domain/validation');

class ImageUploadService {
  constructor({ imageUploadRepository, imageStorage, uploadMaxAgeMs }) {
    this.imageUploadRepository = imageUploadRepository;
    this.imageStorage = imageStorage;
    this.uploadMaxAgeMs = uploadMaxAgeMs;
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
      console.error('Failed to remove consumed image upload metadata:', error);
    }
  }

  async cleanupExpired() {
    const expiredUploads = await this.imageUploadRepository.findExpired(new Date());
    if (expiredUploads.length === 0) {
      return;
    }

    const deletionResults = await Promise.all(
      expiredUploads.map(async (upload) => ({
        id: upload._id,
        deleted: await this.imageStorage.delete(upload.imageUrl)
      }))
    );
    const deletedUploadIds = deletionResults
      .filter((result) => result.deleted)
      .map((result) => result.id);

    if (deletedUploadIds.length > 0) {
      await this.imageUploadRepository.deleteByIds(deletedUploadIds);
    }
  }
}

module.exports = { ImageUploadService };
