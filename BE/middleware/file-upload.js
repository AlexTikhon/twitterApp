const multer = require('multer');
const path = require('path');

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    void req;
    void file;
    cb(null, path.join(__dirname, '..', 'images'));
  },
  filename: (req, file, cb) => {
    void req;
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  void req;

  const isAllowedFileType =
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg';

  cb(null, isAllowedFileType);
};

module.exports = multer({
  storage: fileStorage,
  fileFilter
});
