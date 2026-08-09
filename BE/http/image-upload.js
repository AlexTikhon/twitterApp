const multer = require('multer');

const { createError } = require('../domain/errors');
const { validateObjectId } = require('../domain/validation');

const createImageUploadMiddleware = (maxImageSizeBytes) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxImageSizeBytes, files: 1, fields: 0, parts: 2 },
    fileFilter: (_req, file, callback) => {
      if (!['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {
        callback(createError('Only PNG and JPEG images are supported.', 422));
        return;
      }

      callback(null, true);
    }
  }).single('image');

const requireImageUploadAuth = (req, _res, next) => {
  try {
    if (!req.isAuth) {
      throw createError('Not authenticated.', 401);
    }
    validateObjectId(req.userId, 'user id');
    next();
  } catch (error) {
    next(error);
  }
};

const createImageUploadHandler = (imageUploadService) => async (req, res, next) => {
  try {
    const result = await imageUploadService.upload(req.userId, req.file);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createImageUploadHandler,
  createImageUploadMiddleware,
  requireImageUploadAuth
};
