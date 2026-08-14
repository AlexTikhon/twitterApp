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
  const content = normalizeString(postInput.content);
  const imageUploadId =
    typeof postInput.imageUploadId === 'string' ? postInput.imageUploadId.trim() : '';
  const removeImage = postInput.removeImage === true;
  const errors = [];

  if (!content) {
    errors.push({ message: 'Content is required.', field: 'content' });
  }
  if (content.length > 500) {
    errors.push({ message: 'Content must not exceed 500 characters.', field: 'content' });
  }
  if (imageUploadId && removeImage) {
    errors.push({
      message: 'Choose either a new image or image removal.',
      field: 'imageUploadId'
    });
  }
  if (errors.length > 0) {
    throw createError('Validation failed.', 422, errors);
  }

  return { content, imageUploadId, removeImage };
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

module.exports = {
  normalizeString,
  validateObjectId,
  validatePostInput,
  validateStatus,
  validateUserInput
};
