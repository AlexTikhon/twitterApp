const { decodeCursor, encodeCursor } = require('../domain/cursor');
const { createError } = require('../domain/errors');
const {
  getBoundedPagination,
  validateObjectId,
  validatePostInput
} = require('../domain/validation');

class PostService {
  constructor({
    postRepository,
    userRepository,
    imageStorage,
    imageUploadService,
    postRealtime,
    runInTransaction,
    pagination
  }) {
    this.postRepository = postRepository;
    this.userRepository = userRepository;
    this.imageStorage = imageStorage;
    this.imageUploadService = imageUploadService;
    this.postRealtime = postRealtime;
    this.runInTransaction = runInTransaction;
    this.pagination = pagination;
  }

  async list({ page, limit, first, after }) {
    if (first !== undefined || after !== undefined) {
      return this.listByCursor(first, after);
    }

    const { currentPage, perPage } = getBoundedPagination(
      page,
      limit,
      this.pagination.defaultPageSize,
      this.pagination.maxPageSize
    );
    const [totalItems, posts] = await Promise.all([
      this.postRepository.countAll(),
      this.postRepository.findPage({
        skip: (currentPage - 1) * perPage,
        limit: perPage
      })
    ]);

    return {
      posts,
      totalItems,
      pageInfo: {
        endCursor: posts.length > 0 ? encodeCursor(posts.at(-1)._id) : null,
        hasNextPage: currentPage * perPage < totalItems
      }
    };
  }

  async listByCursor(first = this.pagination.defaultPageSize, after) {
    const requestedLimit = Number(first);
    if (!Number.isInteger(requestedLimit) || requestedLimit <= 0) {
      throw createError('first must be a positive integer.', 400);
    }

    const perPage = Math.min(requestedLimit, this.pagination.maxPageSize);
    const loadedPosts = await this.postRepository.findCursorPage({
      afterId: after ? decodeCursor(after) : null,
      limit: perPage
    });
    const hasNextPage = loadedPosts.length > perPage;
    const posts = hasNextPage ? loadedPosts.slice(0, perPage) : loadedPosts;

    return {
      posts,
      totalItems: await this.postRepository.countAll(),
      pageInfo: {
        endCursor: posts.length > 0 ? encodeCursor(posts.at(-1)._id) : null,
        hasNextPage
      }
    };
  }

  async get(id) {
    validateObjectId(id);
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw createError('Post not found.', 404);
    }

    return post;
  }

  async create(userId, postInput) {
    const input = validatePostInput(postInput);
    if (!input.imageUploadId) {
      throw createError('No image upload provided.', 422);
    }

    const createdPost = await this.runInTransaction(async (session) => {
      const user = await this.userRepository.findById(userId, { session, select: '_id' });
      if (!user) {
        throw createError('User not found.', 404);
      }

      const upload = await this.imageUploadService.consume(input.imageUploadId, userId, session);
      return this.postRepository.create(
        {
          title: input.title,
          content: input.content,
          imageUrl: upload.imageUrl,
          creator: userId
        },
        { session }
      );
    });

    await this.imageUploadService.releaseMetadata(input.imageUploadId);
    await this.postRealtime.emit('create', createdPost._id);
    return createdPost;
  }

  async update(userId, id, postInput) {
    validateObjectId(id);
    const input = validatePostInput(postInput);
    const existingPost = await this.postRepository.findById(id);
    this.assertOwnedPost(existingPost, userId, 'update');

    let previousImageUrl = existingPost.imageUrl;
    const updatedPost = await this.runInTransaction(async (session) => {
      const post = await this.postRepository.findById(id, { session });
      this.assertOwnedPost(post, userId, 'update');
      previousImageUrl = post.imageUrl;

      if (input.imageUploadId) {
        const upload = await this.imageUploadService.consume(input.imageUploadId, userId, session);
        post.imageUrl = upload.imageUrl;
      }

      if (!post.imageUrl) {
        throw createError('No image provided.', 422);
      }

      post.title = input.title;
      post.content = input.content;
      return this.postRepository.save(post, { session });
    });

    await this.imageUploadService.releaseMetadata(input.imageUploadId);
    if (updatedPost.imageUrl !== previousImageUrl) {
      await this.imageStorage.delete(previousImageUrl);
    }
    await this.postRealtime.emit('update', updatedPost._id);
    return updatedPost;
  }

  async delete(userId, id) {
    validateObjectId(id);
    const deletedPost = await this.runInTransaction(async (session) => {
      const post = await this.postRepository.findById(id, { session });
      this.assertOwnedPost(post, userId, 'delete');
      await this.postRepository.deleteById(id, { session });
      return post;
    });

    await this.imageStorage.delete(deletedPost.imageUrl);
    await this.postRealtime.emit('delete', id);
    return true;
  }

  assertOwnedPost(post, userId, action) {
    if (!post) {
      throw createError('Post not found.', 404);
    }
    if (post.creator.toString() !== userId) {
      throw createError(`Not authorized to ${action} this post.`, 403);
    }
  }
}

module.exports = { PostService };
