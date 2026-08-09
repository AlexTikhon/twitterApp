const createError = (message, statusCode, data = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.data = data;
  return error;
};

module.exports = { createError };
