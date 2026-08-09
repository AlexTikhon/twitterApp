const mongoose = require('mongoose');

const Post = require('./models/post');
const User = require('./models/user');
const ImageUpload = require('./models/image-upload');
const socket = require('./socket');
const { createTransactionRunner } = require('./database/transaction');
const { PostRealtime } = require('./realtime/post-realtime');
const { ImageUploadRepository } = require('./repositories/image-upload-repository');
const { PostRepository } = require('./repositories/post-repository');
const { UserRepository } = require('./repositories/user-repository');
const { AuthService } = require('./services/auth-service');
const { ImageUploadService } = require('./services/image-upload-service');
const { PostService } = require('./services/post-service');
const { ProfileService } = require('./services/profile-service');
const { LocalImageStorage } = require('./storage/local-image-storage');

const createDependencies = (config, connection = mongoose.connection) => {
  const postRepository = new PostRepository(Post);
  const userRepository = new UserRepository(User);
  const imageUploadRepository = new ImageUploadRepository(ImageUpload);
  const imageStorage = new LocalImageStorage(config.storage);
  const postRealtime = new PostRealtime({
    postRepository,
    getIo: socket.getIo
  });

  const imageUploads = new ImageUploadService({
    imageUploadRepository,
    imageStorage,
    uploadMaxAgeMs: config.storage.uploadMaxAgeMs
  });
  const services = {
    auth: new AuthService({
      userRepository,
      jwtSecret: config.jwtSecret,
      jwtExpiresInSeconds: config.jwtExpiresInSeconds
    }),
    imageUploads,
    posts: new PostService({
      postRepository,
      userRepository,
      imageStorage,
      imageUploadService: imageUploads,
      postRealtime,
      runInTransaction: createTransactionRunner(connection),
      pagination: config.posts
    }),
    profile: new ProfileService({ userRepository })
  };

  return {
    imageStorage,
    repositories: {
      imageUpload: imageUploadRepository,
      post: postRepository,
      user: userRepository
    },
    services
  };
};

module.exports = { createDependencies };
