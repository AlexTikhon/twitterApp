const jwt = require('jsonwebtoken');

const createAuthMiddleware = (jwtSecret) => (req, _res, next) => {
  req.isAuth = false;

  const authHeader = req.get('Authorization');
  if (!authHeader) {
    return next();
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next();
  }

  try {
    const decodedToken = jwt.verify(token, jwtSecret);
    req.isAuth = Boolean(decodedToken.userId);
    req.userId = decodedToken.userId;
  } catch {
    req.isAuth = false;
  }

  return next();
};

module.exports = { createAuthMiddleware };
