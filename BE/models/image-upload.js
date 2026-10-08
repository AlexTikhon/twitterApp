const mongoose = require('mongoose');

const { Schema } = mongoose;

const imageUploadSchema = new Schema(
  {
    imageUrl: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    // Set atomically by cleanup before the file is deleted; consumption excludes claimed uploads.
    cleanupClaimedAt: { type: Date, default: null },
    cleanupClaimToken: { type: String, default: null }
  },
  { timestamps: true }
);

imageUploadSchema.index({ owner: 1, consumedAt: 1, expiresAt: 1 });
imageUploadSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('ImageUpload', imageUploadSchema);
