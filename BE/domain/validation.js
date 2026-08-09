const { Types } = require('mongoose');

const { createError } = require('./errors');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const validateObjectId = (id, field = 'id') => {
  if (typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id) || !Types.ObjectId.isValid(id)) {
    throw createError(`Invalid ${field}.`, 400);
  }

  return id;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeString(email));

const validateUserInput = (userInput) => {
  const email = normalizeString(userInput.email).toLowerCase();
  const password = typeof userInput.password === 'string' ? userInput.password : '';
  const name = normalizeString(userInput.name);
  const errors = [];

  if (!validateEmail(email)) {
    errors.push({ message: 'Please enter a valid email.', field: 'email' });
  }
  if (email.length > 254) {
    errors.push({ message: 'Email must not exceed 254 characters.', field: 'email' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    errors.push({ message: 'Password must be 8-72 bytes long.', field: 'password' });
  }
  if (!name || name.length > 80) {
    errors.push({ message: 'Name must be 1-80 characters long.', field: 'name' });
  }
  if (errors.length > 0) {
    throw createError('Validation failed.', 422, errors);
  }

  return { email, password, name };
};

const validatePostInput = (postInput) => {
  const title = normalizeString(postInput.title);
  const content = normalizeString(postInput.content);
  const imageUploadId =
    typeof postInput.imageUploadId === 'string' ? postInput.imageUploadId.trim() : '';
  const errors = [];

  if (title.length < 5) {
    errors.push({ message: 'Title must be at least 5 characters long.', field: 'title' });
  }
  if (title.length > 120) {
    errors.push({ message: 'Title must not exceed 120 characters.', field: 'title' });
  }
  if (content.length < 5) {
    errors.push({ message: 'Content must be at least 5 characters long.', field: 'content' });
  }
  if (content.length > 5000) {
    errors.push({ message: 'Content must not exceed 5000 characters.', field: 'content' });
  }
  if (errors.length > 0) {
    throw createError('Validation failed.', 422, errors);
  }

  return { title, content, imageUploadId };
};

const validateStatus = (status) => {
  const normalizedStatus = normalizeString(status);

  if (!normalizedStatus || normalizedStatus.length > 160) {
    throw createError('Status must be 1-160 characters long.', 422, [
      { message: 'Status must be 1-160 characters long.', field: 'status' }
    ]);
  }

  return normalizedStatus;
};

const getBoundedPagination = (page, limit, defaultLimit, maxLimit) => ({
  currentPage: Math.max(Number(page) || 1, 1),
  perPage: Math.min(Math.max(Number(limit) || defaultLimit, 1), maxLimit)
});

module.exports = {
  getBoundedPagination,
  normalizeString,
  validateObjectId,
  validatePostInput,
  validateStatus,
  validateUserInput
};
