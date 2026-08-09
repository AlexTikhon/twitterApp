class PostRepository {
  constructor(PostModel) {
    this.Post = PostModel;
  }

  countAll() {
    return this.Post.countDocuments();
  }

  findPage({ skip, limit }) {
    return this.Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
  }

  findCursorPage({ afterId, limit }) {
    const filter = afterId ? { _id: { $lt: afterId } } : {};
    return this.Post.find(filter)
      .sort({ _id: -1 })
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
