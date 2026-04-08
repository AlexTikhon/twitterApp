const { validationResult } = require('express-validator');

const Post = require('../models/post');
const User = require('../models/user');
const clearImage = require('../util/file');

const getImagePath = file => `/images/${file.filename}`;

exports.getPosts = async (req, res, next) => {
  try {
    const currentPage = Number(req.query.page || 1);
    const perPage = Number(req.query.limit || 2);

    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate('creator', 'name')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: 'Fetched posts successfully.',
      posts,
      totalItems
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const error = new Error('Validation failed.');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    if (!req.file) {
      const error = new Error('No image provided.');
      error.statusCode = 422;
      throw error;
    }

    const { title, content } = req.body;

    const post = new Post({
      title,
      content,
      imageUrl: getImagePath(req.file),
      creator: req.userId
    });

    const createdPost = await post.save();

    await User.findByIdAndUpdate(req.userId, {
      $push: { posts: createdPost._id }
    });

    const populatedPost = await createdPost.populate('creator', 'name');

    res.status(201).json({
      message: 'Post created successfully.',
      post: populatedPost
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).populate('creator', 'name');

    if (!post) {
      const error = new Error('Post not found.');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: 'Post fetched successfully.',
      post
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const error = new Error('Validation failed.');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const { postId } = req.params;
    const { title, content, oldPath } = req.body;

    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Post not found.');
      error.statusCode = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId) {
      const error = new Error('Not authorized to update this post.');
      error.statusCode = 403;
      throw error;
    }

    let imageUrl = post.imageUrl;

    if (req.file) {
      imageUrl = getImagePath(req.file);
    } else if (oldPath) {
      imageUrl = oldPath;
    }

    if (!imageUrl) {
      const error = new Error('No image provided.');
      error.statusCode = 422;
      throw error;
    }

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;

    const updatedPost = await post.save();
    await updatedPost.populate('creator', 'name');

    res.status(200).json({
      message: 'Post updated successfully.',
      post: updatedPost
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Post not found.');
      error.statusCode = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId) {
      const error = new Error('Not authorized to delete this post.');
      error.statusCode = 403;
      throw error;
    }

    clearImage(post.imageUrl);
    await Post.findByIdAndDelete(postId);
    await User.findByIdAndUpdate(req.userId, {
      $pull: { posts: postId }
    });

    res.status(200).json({
      message: 'Post deleted successfully.'
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('status');

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: 'Status fetched successfully.',
      status: user.status
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    user.status = typeof status === 'string' ? status : user.status;
    await user.save();

    res.status(200).json({
      message: 'Status updated successfully.',
      status: user.status
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
