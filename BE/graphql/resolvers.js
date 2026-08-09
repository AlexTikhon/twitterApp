// Implements the GraphQL operations for auth, feed management, and user status.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');

const User = require('../models/user');
const Post = require('../models/post');
const clearImage = require('../util/file');
const saveImageFromBase64 = require('../util/image');
const socket = require('../socket');

const DEFAULT_POSTS_PAGE_SIZE = 2;
const DEFAULT_MAX_POSTS_PAGE_SIZE = 20;
const DUMMY_PASSWORD_HASH = bcrypt.hash(
  'constant-time-login-comparison-only',
  12
);

// Creates an error object carrying HTTP-like metadata for Apollo formatting.
const createError = (message, statusCode, data = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.data = data;
  return error;
};

// Serializes MongoDB dates into ISO strings for GraphQL responses.
const formatDate = date => new Date(date).toISOString();

// Trims strings safely while converting non-strings to an empty value.
const normalizeString = value =>
  typeof value === 'string' ? value.trim() : '';

// Rejects malformed MongoDB ids before they reach Mongoose queries.
const validateObjectId = (id, field = 'id') => {
  if (
    typeof id !== 'string' ||
    !/^[0-9a-fA-F]{24}$/.test(id) ||
    !Types.ObjectId.isValid(id)
  ) {
    throw createError(`Invalid ${field}.`, 400);
  }
};

// Reads a positive integer env value while falling back to a safe default.
const getPositiveIntegerEnv = (name, fallback) => {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
};

// Keeps pagination requests bounded even when callers provide a large limit.
const getBoundedPagination = (page, limit) => {
  const currentPage = Math.max(Number(page) || 1, 1);
  const requestedLimit = Math.max(Number(limit) || DEFAULT_POSTS_PAGE_SIZE, 1);
  const maxLimit = getPositiveIntegerEnv(
    'POSTS_PAGE_SIZE_LIMIT',
    DEFAULT_MAX_POSTS_PAGE_SIZE
  );

  return {
    currentPage,
    perPage: Math.min(requestedLimit, maxLimit)
  };
};

// Checks whether a normalized email has a basic valid email shape.
const validateEmail = email =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeString(email));

// Queries and mutations that need the current user fail fast here.
const ensureAuth = req => {
  if (!req.isAuth) {
    throw createError('Not authenticated.', 401);
  }

  validateObjectId(req.userId, 'user id');
};

// Validates and normalizes signup input before creating a user.
const validateUserInput = userInput => {
  const email = normalizeString(userInput.email).toLowerCase();
  const password =
    typeof userInput.password === 'string' ? userInput.password : '';
  const name = normalizeString(userInput.name);
  const errors = [];

  if (!validateEmail(email)) {
    errors.push({ message: 'Please enter a valid email.', field: 'email' });
  }

  if (email.length > 254) {
    errors.push({ message: 'Email must not exceed 254 characters.', field: 'email' });
  }

  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    errors.push({
      message: 'Password must be 8-72 bytes long.',
      field: 'password'
    });
  }

  if (!name || name.length > 80) {
    errors.push({ message: 'Name must be 1-80 characters long.', field: 'name' });
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

// Validates and normalizes post form input before persistence.
const validatePostInput = postInput => {
  const title = normalizeString(postInput.title);
  const content = normalizeString(postInput.content);
  const image =
    typeof postInput.image === 'string' ? postInput.image : '';
  const errors = [];

  if (title.length < 5) {
    errors.push({
      message: 'Title must be at least 5 characters long.',
      field: 'title'
    });
  }

  if (title.length > 120) {
    errors.push({
      message: 'Title must not exceed 120 characters.',
      field: 'title'
    });
  }

  if (content.length < 5) {
    errors.push({
      message: 'Content must be at least 5 characters long.',
      field: 'content'
    });
  }

  if (content.length > 5000) {
    errors.push({
      message: 'Content must not exceed 5000 characters.',
      field: 'content'
    });
  }

  if (errors.length > 0) {
    throw createError('Validation failed.', 422, errors);
  }

  return {
    title,
    content,
    image
  };
};

// Extracts a user id from populated, unpopulated, or string creator values.
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

// Mongoose documents are converted into plain GraphQL-friendly objects here.
const transformPost = post => ({
  ...post._doc,
  _id: post._id.toString(),
  createdAt: formatDate(post.createdAt),
  updatedAt: formatDate(post.updatedAt),
  creator: user.bind(this, getCreatorId(post.creator))
});

// Converts a Mongoose user document into the GraphQL user response shape.
const transformUser = userDoc => ({
  ...userDoc._doc,
  _id: userDoc._id.toString(),
  password: null,
  createdAt: formatDate(userDoc.createdAt),
  updatedAt: formatDate(userDoc.updatedAt),
  posts: posts.bind(this, userDoc._doc.posts)
});

// Loads a user for nested GraphQL creator/post fields.
const user = async userId => {
  const foundUser = await User.findById(userId);

  if (!foundUser) {
    throw createError('User not found.', 404);
  }

  return transformUser(foundUser);
};

// Loads posts for nested GraphQL user.posts fields.
const posts = async postIds => {
  const foundPosts = await Post.find({ _id: { $in: postIds } });

  return foundPosts.map(transformPost);
};

// Socket payloads are resolved with a populated creator so the client can
// update the feed immediately without issuing another query.
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

// Realtime delivery must not turn an already-committed mutation into an error.
const emitPostEvent = async (action, postId) => {
  try {
    const post =
      action === 'delete'
        ? { _id: postId.toString() }
        : await getSocketPostPayload(postId);

    socket.getIo().emit('posts', { action, post });
  } catch (error) {
    console.error(`Failed to emit post ${action} event:`, error);
  }
};

// New images arrive as base64 strings; only the server may reuse a stored path.
const resolveImagePath = async (image, currentImagePath = '') => {
  if (image && image.startsWith('data:image/')) {
    return saveImageFromBase64(image);
  }

  if (image) {
    throw createError('Invalid image payload.', 422);
  }

  return currentImagePath;
};

const rootResolvers = {
  // Registers a new account after validating and hashing the supplied password.
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
  // Authenticates a user and returns a short-lived JWT session payload.
  login: async ({ email, password }) => {
    const normalizedEmail = normalizeString(email).toLowerCase();
    const normalizedPassword = typeof password === 'string' ? password : '';
    const user = await User.findOne({ email: normalizedEmail });
    const passwordIsSupported = Buffer.byteLength(normalizedPassword, 'utf8') <= 72;
    const passwordHash = user ? user.password : await DUMMY_PASSWORD_HASH;
    const isEqual = await bcrypt.compare(
      passwordIsSupported ? normalizedPassword : '',
      passwordHash
    );

    if (!user || !passwordIsSupported || !isEqual) {
      throw createError('Invalid email or password.', 401);
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
  // Returns a paginated feed for the authenticated user.
  posts: async ({ page = 1, limit = DEFAULT_POSTS_PAGE_SIZE }, req) => {
    ensureAuth(req);

    const { currentPage, perPage } = getBoundedPagination(page, limit);
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
  // Returns one post by id for the authenticated single-post page.
  post: async ({ id }, req) => {
    ensureAuth(req);
    validateObjectId(id);

    const post = await Post.findById(id);

    if (!post) {
      throw createError('Post not found.', 404);
    }

    return transformPost(post);
  },
  // Returns the profile status for the authenticated user.
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
  // Creates a post, stores its image, links it to the user, and broadcasts it.
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

    let createdPost;

    try {
      createdPost = await post.save();

      const updatedUser = await User.findByIdAndUpdate(req.userId, {
        $push: { posts: createdPost._id }
      });

      if (!updatedUser) {
        throw createError('User not found.', 404);
      }
    } catch (error) {
      if (createdPost) {
        await Post.findByIdAndDelete(createdPost._id).catch(cleanupError => {
          console.error('Failed to roll back post creation:', cleanupError);
        });
      }
      await clearImage(imageUrl);
      throw error;
    }

    await emitPostEvent('create', createdPost._id);

    return transformPost(createdPost);
  },
  // Updates a post owned by the current user and broadcasts the new snapshot.
  updatePost: async ({ id, postInput }, req) => {
    ensureAuth(req);
    validateObjectId(id);

    const validatedPostInput = validatePostInput(postInput);
    const post = await Post.findById(id);

    if (!post) {
      throw createError('Post not found.', 404);
    }

    if (post.creator.toString() !== req.userId) {
      throw createError('Not authorized to update this post.', 403);
    }

    const previousImageUrl = post.imageUrl;
    const imageUrl = await resolveImagePath(validatedPostInput.image, previousImageUrl);

    if (!imageUrl) {
      throw createError('No image provided.', 422);
    }

    post.title = validatedPostInput.title;
    post.content = validatedPostInput.content;
    post.imageUrl = imageUrl;

    try {
      await post.save();
    } catch (error) {
      if (imageUrl !== previousImageUrl) {
        await clearImage(imageUrl);
      }
      throw error;
    }

    if (imageUrl !== previousImageUrl) {
      // The old file is removed only after MongoDB references the new one.
      await clearImage(previousImageUrl);
    }

    await emitPostEvent('update', post._id);

    return transformPost(post);
  },
  // Deletes a post owned by the current user and broadcasts the removal.
  deletePost: async ({ id }, req) => {
    ensureAuth(req);
    validateObjectId(id);

    const post = await Post.findById(id);

    if (!post) {
      throw createError('Post not found.', 404);
    }

    if (post.creator.toString() !== req.userId) {
      throw createError('Not authorized to delete this post.', 403);
    }

    await Post.findByIdAndDelete(id);

    try {
      await User.findByIdAndUpdate(req.userId, {
        $pull: { posts: id }
      });
    } catch (error) {
      // Restore the post if the denormalized user relation could not be updated.
      await Post.create(post.toObject()).catch(rollbackError => {
        console.error('Failed to roll back post deletion:', rollbackError);
      });
      throw error;
    }
    // Delete the file only after the database no longer references it.
    await clearImage(post.imageUrl);

    await emitPostEvent('delete', id);

    return true;
  },
  // Updates and returns the authenticated user's profile status.
  updateStatus: async ({ status }, req) => {
    ensureAuth(req);

    const normalizedStatus = normalizeString(status);

    if (!normalizedStatus || normalizedStatus.length > 160) {
      throw createError('Status must be 1-160 characters long.', 422, [
        { message: 'Status must be 1-160 characters long.', field: 'status' }
      ]);
    }

    const foundUser = await User.findById(req.userId);

    if (!foundUser) {
      throw createError('User not found.', 404);
    }

    foundUser.status = normalizedStatus;
    await foundUser.save();

    return {
      status: foundUser.status
    };
  }
};

// Adapts the old root resolver signature to Apollo's resolver map signature.
const withRequest = resolver => (parent, args, context) =>
  resolver(args, context.req);

module.exports = {
  RootQuery: {
    posts: withRequest(rootResolvers.posts),
    post: withRequest(rootResolvers.post),
    status: withRequest(rootResolvers.status)
  },
  RootMutation: {
    createUser: withRequest(rootResolvers.createUser),
    login: withRequest(rootResolvers.login),
    createPost: withRequest(rootResolvers.createPost),
    updatePost: withRequest(rootResolvers.updatePost),
    deletePost: withRequest(rootResolvers.deletePost),
    updateStatus: withRequest(rootResolvers.updateStatus)
  }
};
