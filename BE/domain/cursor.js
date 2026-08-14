const { createError } = require('./errors');
const { validateObjectId } = require('./validation');

const normalizeCursor = ({ createdAt, id, _id }) => {
  const normalizedId = (id || _id)?.toString();
  validateObjectId(normalizedId, 'cursor');

  const normalizedDate = new Date(createdAt);
  if (Number.isNaN(normalizedDate.getTime())) {
    throw createError('Invalid cursor.', 400);
  }

  return { createdAt: normalizedDate.toISOString(), id: normalizedId };
};

const encodeCursor = (value) => {
  const { createdAt, id } = normalizeCursor(value);
  return Buffer.from(JSON.stringify([createdAt, id]), 'utf8').toString('base64url');
};

const decodeCursor = (cursor) => {
  if (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw createError('Invalid cursor.', 400);
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw createError('Invalid cursor.', 400);
  }

  if (!Array.isArray(decoded) || decoded.length !== 2) {
    throw createError('Invalid cursor.', 400);
  }

  const value = normalizeCursor({ createdAt: decoded[0], id: decoded[1] });

  if (encodeCursor(value) !== cursor) {
    throw createError('Invalid cursor.', 400);
  }

  return { createdAt: new Date(value.createdAt), id: value.id };
};

module.exports = { decodeCursor, encodeCursor };
