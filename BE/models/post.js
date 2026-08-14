const mongoose = require('mongoose');

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    imageUrl: {
      type: String,
      default: null
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

postSchema.index({ createdAt: -1, _id: -1 });
postSchema.index({ creator: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('Post', postSchema);
