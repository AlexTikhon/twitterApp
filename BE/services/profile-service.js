const { createError } = require('../domain/errors');
const { validateObjectId, validateStatus } = require('../domain/validation');

class ProfileService {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async getUser(userId) {
    validateObjectId(userId, 'user id');
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw createError('User not found.', 404);
    }

    return user;
  }

  async getStatus(userId) {
    const user = await this.userRepository.findById(userId, { select: 'status' });
    if (!user) {
      throw createError('User not found.', 404);
    }

    return { status: user.status };
  }

  async updateStatus(userId, status) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw createError('User not found.', 404);
    }

    user.status = validateStatus(status);
    await this.userRepository.save(user);
    return { status: user.status };
  }
}

module.exports = { ProfileService };
