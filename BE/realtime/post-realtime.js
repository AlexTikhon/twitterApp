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
  constructor({ postRepository, getIo }) {
    this.postRepository = postRepository;
    this.getIo = getIo;
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
      console.error(`Failed to emit post ${action} event:`, error);
    }
  }
}

module.exports = { PostRealtime };
