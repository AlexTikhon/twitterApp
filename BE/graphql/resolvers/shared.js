const { createError } = require('../../domain/errors');
const { validateObjectId } = require('../../domain/validation');

const requireAuthenticatedUser = (req) => {
  if (!req.isAuth) {
    throw createError('Not authenticated.', 401);
  }

  validateObjectId(req.userId, 'user id');
  return req.userId;
};

module.exports = { requireAuthenticatedUser };
