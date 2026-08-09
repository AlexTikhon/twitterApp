class ImageUploadRepository {
  constructor(ImageUploadModel) {
    this.ImageUpload = ImageUploadModel;
  }

  async create(data) {
    return new this.ImageUpload(data).save();
  }

  consume(id, owner, now, { session } = {}) {
    return this.ImageUpload.findOneAndUpdate(
      {
        _id: id,
        owner,
        consumedAt: null,
        expiresAt: { $gt: now }
      },
      { $set: { consumedAt: now } },
      { new: true, session }
    );
  }

  deleteById(id) {
    return this.ImageUpload.findByIdAndDelete(id);
  }

  findExpired(now, limit = 100) {
    return this.ImageUpload.find({ consumedAt: null, expiresAt: { $lte: now } }).limit(limit);
  }

  deleteByIds(ids) {
    return this.ImageUpload.deleteMany({ _id: { $in: ids }, consumedAt: null });
  }
}

module.exports = { ImageUploadRepository };
