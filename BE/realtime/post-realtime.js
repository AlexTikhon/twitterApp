const serializePost = (post) => ({
  ...post.toObject(),
  _id: post._id.toString(),
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
  creator: {
    _id: post.creator._id.toString(),
    name: post.creator.name
  }
});

class PostRealtime {
  constructor({ postRepository, getIo, logger }) {
    this.postRepository = postRepository;
    this.getIo = getIo;
    this.logger = logger;
  }

  async emit(action, postId) {
    try {
      const post =
        action === 'delete'
          ? { _id: postId.toString() }
          : serializePost(
              await this.postRepository.findById(postId, {
                populateCreator: true
              })
            );

      this.getIo().emit('posts', { action, post });
    } catch (error) {
      this.logger?.error({ err: error, action, postId }, 'Failed to emit post event');
    }
  }
}

module.exports = { PostRealtime };
