// Stores the feed entries shown in the timeline and single-post pages.
const mongoose = require('mongoose');

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    imageUrl: {
      type: String,
      default: ''
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

module.exports = mongoose.model('Post', postSchema);
