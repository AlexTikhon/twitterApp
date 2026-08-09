const { createError } = require('./errors');
const { validateObjectId } = require('./validation');

const encodeCursor = (id) => Buffer.from(id.toString(), 'utf8').toString('base64url');

const decodeCursor = (cursor) => {
  if (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw createError('Invalid cursor.', 400);
  }

  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  validateObjectId(id, 'cursor');

  if (encodeCursor(id) !== cursor) {
    throw createError('Invalid cursor.', 400);
  }

  return id;
};

module.exports = { decodeCursor, encodeCursor };
