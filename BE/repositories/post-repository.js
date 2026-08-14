class PostRepository {
  constructor(PostModel) {
    this.Post = PostModel;
  }

  count({ creatorId } = {}) {
    return this.Post.countDocuments(creatorId ? { creator: creatorId } : {});
  }

  findCursorPage({ after, creatorId, limit }) {
    const filter = creatorId ? { creator: creatorId } : {};
    if (after) {
      filter.$or = [
        { createdAt: { $lt: after.createdAt } },
        { createdAt: after.createdAt, _id: { $lt: after.id } }
      ];
    }

    return this.Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);
  }

  findById(id, { session, populateCreator = false } = {}) {
    let query = this.Post.findById(id).session(session || null);

    if (populateCreator) {
      query = query.populate('creator', 'name');
    }

    return query;
  }

  async create(data, { session } = {}) {
    const post = new this.Post(data);
    return post.save({ session });
  }

  async save(post, { session } = {}) {
    return post.save({ session });
  }

  deleteById(id, { session } = {}) {
    return this.Post.findByIdAndDelete(id).session(session || null);
  }
}

module.exports = { PostRepository };
