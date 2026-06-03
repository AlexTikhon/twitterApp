// Reads the bearer token once per request and stores the auth state on req.
const jwt = require('jsonwebtoken');

// Decodes the bearer token and attaches auth flags to the Express request.
module.exports = (req, res, next) => {
  req.isAuth = false;

  const authHeader = req.get('Authorization');

  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.isAuth = true;
    req.userId = decodedToken.userId;
  } catch (err) {
    req.isAuth = false;
  }

  next();
};
