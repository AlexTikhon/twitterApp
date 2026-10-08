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
        cleanupClaimedAt: null,
        expiresAt: { $gt: now }
      },
      { $set: { consumedAt: now } },
      { new: true, session }
    );
  }

  deleteById(id) {
    return this.ImageUpload.findByIdAndDelete(id);
  }

  // Claims expired, unconsumed uploads for file deletion. The conditional write contends with an
  // in-flight consumption of the same document, so one of the two always wins. Claims left by a
  // crashed cleanup become claimable again once they are older than the lease.
  async claimExpired(now, { token, leaseMs, limit = 100 }) {
    const claimable = {
      consumedAt: null,
      expiresAt: { $lte: now },
      $or: [
        { cleanupClaimedAt: null },
        { cleanupClaimedAt: { $lte: new Date(now.getTime() - leaseMs) } }
      ]
    };
    const candidates = await this.ImageUpload.find(claimable).select('_id').limit(limit).lean();
    if (candidates.length === 0) {
      return [];
    }

    await this.ImageUpload.updateMany(
      { ...claimable, _id: { $in: candidates.map((candidate) => candidate._id) } },
      { $set: { cleanupClaimedAt: now, cleanupClaimToken: token } }
    );
    return this.ImageUpload.find({ cleanupClaimToken: token, consumedAt: null });
  }

  deleteClaimed(ids, token) {
    return this.ImageUpload.deleteMany({
      _id: { $in: ids },
      cleanupClaimToken: token,
      consumedAt: null
    });
  }

  releaseClaim(ids, token) {
    return this.ImageUpload.updateMany(
      { _id: { $in: ids }, cleanupClaimToken: token, consumedAt: null },
      { $set: { cleanupClaimedAt: null, cleanupClaimToken: null } }
    );
  }
}

module.exports = { ImageUploadRepository };
