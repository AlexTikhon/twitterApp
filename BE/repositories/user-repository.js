class UserRepository {
  constructor(UserModel) {
    this.User = UserModel;
  }

  findByEmail(email, { session } = {}) {
    return this.User.findOne({ email }).session(session || null);
  }

  findById(id, { session, select } = {}) {
    let query = this.User.findById(id).session(session || null);

    if (select) {
      query = query.select(select);
    }

    return query;
  }

  findByIds(ids, { session } = {}) {
    return this.User.find({ _id: { $in: ids } }).session(session || null);
  }

  async create(data, { session } = {}) {
    const user = new this.User(data);
    return user.save({ session });
  }

  async save(user, { session } = {}) {
    return user.save({ session });
  }
}

module.exports = { UserRepository };
