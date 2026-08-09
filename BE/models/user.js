// Stores login credentials plus the profile status displayed in the feed.
const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 254
    },
    password: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    status: {
      type: String,
      default: 'New mini-twitter user',
      maxlength: 160
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
