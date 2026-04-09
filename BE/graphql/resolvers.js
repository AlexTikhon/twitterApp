const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');
const clearImage = require('../util/file');
const saveImageFromBase64 = require('../util/image');
const socket = require('../socket');

const createError = (message, statusCode, data = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.data = data;
  return error;
};

const formatDate = date => new Date(date).toISOString();

const normalizeString = value =>
  typeof value === 'string' ? value.trim() : '';

const validateEmail = email =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeString(email));

const ensureAuth = req => {
  if (!req.isAuth) {
    throw createError('Not authenticated.', 401);
  }
};

const validateUserInput = userInput => {
  const email = normalizeString(userInput.email).toLowerCase();
  const password = normalizeString(userInput.password);
  const name = normalizeString(userInput.name);
  const errors = [];

  if (!validateEmail(email)) {
    errors.push({ message: 'Please enter a valid email.', field: 'email' });
  }

  if (password.length < 5) {
    errors.push({
      message: 'Password must be at least 5 characters long.',
      field: 'password'
    });
  }

  if (!name) {
    errors.push({ message: 'Name is required.', field: 'name' });
  }

  if (errors.length > 0) {
    throw createError('Validation failed.', 422, errors);
  }

  return {
    email,
    password,
    name
  };
};

const validatePostInput = postInput => {
  const title = normalizeString(postInput.title);
  const content = normalizeString(postInput.content);
  const image =
    typeof postInput.image === 'string' ? postInput.image : '';
  const oldImagePath =
    typeof postInput.oldImagePath === 'string'
      ? postInput.oldImagePath
      : '';
  const errors = [];

  if (title.length < 5) {
    errors.push({
      message: 'Title must be at least 5 characters long.',
      field: 'title'
    });
  }

  if (content.length < 5) {
    errors.push({
      message: 'Content must be at least 5 characters long.',
      field: 'content'
    });
  }

  if (errors.length > 0) {
    throw createError('Validation failed.', 422, errors);
  }

  return {
    title,
    content,
    image,
    oldImagePath
  };
};

const getCreatorId = creator => {
  if (!creator) {
    return '';
  }

  if (typeof creator === 'string') {
    return creator;
  }

  if (creator._id) {
    return creator._id.toString();
  }

  return creator.toString();
};

const transformPost = post => ({
  ...post._doc,
  _id: post._id.toString(),
  createdAt: formatDate(post.createdAt),
  updatedAt: formatDate(post.updatedAt),
  creator: user.bind(this, getCreatorId(post.creator))
});

const transformUser = userDoc => ({
  ...userDoc._doc,
  _id: userDoc._id.toString(),
  password: null,
  createdAt: formatDate(userDoc.createdAt),
  updatedAt: formatDate(userDoc.updatedAt),
  posts: posts.bind(this, userDoc._doc.posts)
});

const user = async userId => {
  const foundUser = await User.findById(userId);

  if (!foundUser) {
    throw createError('User not found.', 404);
  }

  return transformUser(foundUser);
};

const posts = async postIds => {
  const foundPosts = await Post.find({ _id: { $in: postIds } });

  return foundPosts.map(transformPost);
};

const getSocketPostPayload = async postId => {
  const populatedPost = await Post.findById(postId).populate('creator', 'name');

  if (!populatedPost) {
    throw createError('Post not found.', 404);
  }

  return {
    ...populatedPost.toObject(),
    _id: populatedPost._id.toString(),
    createdAt: formatDate(populatedPost.createdAt),
    updatedAt: formatDate(populatedPost.updatedAt),
    creator: {
      _id: populatedPost.creator._id.toString(),
      name: populatedPost.creator.name
    }
  };
};

const resolveImagePath = async (image, oldImagePath, currentImagePath = '') => {
  if (image && image.startsWith('data:image/')) {
    return saveImageFromBase64(image);
  }

  if (oldImagePath) {
    return oldImagePath;
  }

  if (image && image.startsWith('/images/')) {
    return image;
  }

  return currentImagePath;
};

module.exports = {
  createUser: async ({ userInput }) => {
    const validatedUserInput = validateUserInput(userInput);

    const existingUser = await User.findOne({ email: validatedUserInput.email });
    if (existingUser) {
      throw createError('User already exists.', 409);
    }

    const hashedPassword = await bcrypt.hash(validatedUserInput.password, 12);

    const user = new User({
      email: validatedUserInput.email,
      password: hashedPassword,
      name: validatedUserInput.name
    });

    const createdUser = await user.save();
    return transformUser(createdUser);
  },
  login: async ({ email, password }) => {
    const normalizedEmail = normalizeString(email).toLowerCase();
    const normalizedPassword = normalizeString(password);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      throw createError('A user with this email could not be found.', 401);
    }

    const isEqual = await bcrypt.compare(normalizedPassword, user.password);
    if (!isEqual) {
      throw createError('Wrong password.', 401);
    }

    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString()
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return {
      token,
      userId: user._id.toString(),
      expiresIn: 3600
    };
  },
  posts: async ({ page = 1, limit = 2 }, req) => {
    ensureAuth(req);

    const currentPage = Math.max(Number(page) || 1, 1);
    const perPage = Math.max(Number(limit) || 2, 1);
    const totalItems = await Post.find().countDocuments();
    const loadedPosts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    return {
      posts: loadedPosts.map(transformPost),
      totalItems
    };
  },
  post: async ({ id }, req) => {
    ensureAuth(req);

    const post = await Post.findById(id);

    if (!post) {
      throw createError('Post not found.', 404);
    }

    return transformPost(post);
  },
  status: async (args, req) => {
    ensureAuth(req);

    const foundUser = await User.findById(req.userId).select('status');

    if (!foundUser) {
      throw createError('User not found.', 404);
    }

    return {
      status: foundUser.status
    };
  },
  createPost: async ({ postInput }, req) => {
    ensureAuth(req);

    const validatedPostInput = validatePostInput(postInput);

    if (!validatedPostInput.image) {
      throw createError('No image provided.', 422);
    }

    const imageUrl = await resolveImagePath(validatedPostInput.image);
    if (!imageUrl) {
      throw createError('No image provided.', 422);
    }

    const post = new Post({
      title: validatedPostInput.title,
      content: validatedPostInput.content,
      imageUrl,
      creator: req.userId
    });

    const createdPost = await post.save();

    await User.findByIdAndUpdate(req.userId, {
      $push: { posts: createdPost._id }
    });

    const socketPost = await getSocketPostPayload(createdPost._id);
    socket.getIo().emit('posts', {
      action: 'create',
      post: socketPost
    });

    return transformPost(createdPost);
  },
  updatePost: async ({ id, postInput }, req) => {
    ensureAuth(req);

    const validatedPostInput = validatePostInput(postInput);
    const post = await Post.findById(id);

    if (!post) {
      throw createError('Post not found.', 404);
    }

    if (post.creator.toString() !== req.userId) {
      throw createError('Not authorized to update this post.', 403);
    }

    const imageUrl = await resolveImagePath(
      validatedPostInput.image,
      validatedPostInput.oldImagePath,
      post.imageUrl
    );

    if (!imageUrl) {
      throw createError('No image provided.', 422);
    }

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = validatedPostInput.title;
    post.content = validatedPostInput.content;
    post.imageUrl = imageUrl;

    await post.save();

    const socketPost = await getSocketPostPayload(post._id);
    socket.getIo().emit('posts', {
      action: 'update',
      post: socketPost
    });

    return transformPost(post);
  },
  deletePost: async ({ id }, req) => {
    ensureAuth(req);

    const post = await Post.findById(id);

    if (!post) {
      throw createError('Post not found.', 404);
    }

    if (post.creator.toString() !== req.userId) {
      throw createError('Not authorized to delete this post.', 403);
    }

    clearImage(post.imageUrl);
    await Post.findByIdAndDelete(id);
    await User.findByIdAndUpdate(req.userId, {
      $pull: { posts: id }
    });

    socket.getIo().emit('posts', {
      action: 'delete',
      post: {
        _id: id
      }
    });

    return true;
  },
  updateStatus: async ({ status }, req) => {
    ensureAuth(req);

    const foundUser = await User.findById(req.userId);

    if (!foundUser) {
      throw createError('User not found.', 404);
    }

    foundUser.status =
      typeof status === 'string' ? status : foundUser.status;
    await foundUser.save();

    return {
      status: foundUser.status
    };
  }
};
