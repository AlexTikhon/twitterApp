const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

exports.init = (server, { allowedOrigins, jwtSecret }) => {
  io = socketIo(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  });

  // Realtime feed data is available only to users with a valid access token.
  io.use((client, next) => {
    const authToken = client.handshake.auth?.token;
    const authorizationHeader = client.handshake.headers.authorization;
    const bearerToken =
      typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')
        ? authorizationHeader.slice(7)
        : '';
    const token = authToken || bearerToken;

    if (!token) {
      return next(new Error('Not authenticated.'));
    }

    try {
      const decodedToken = jwt.verify(token, jwtSecret);

      if (!decodedToken.userId) {
        return next(new Error('Not authenticated.'));
      }

      client.data.userId = decodedToken.userId;
      return next();
    } catch {
      return next(new Error('Not authenticated.'));
    }
  });

  return io;
};

exports.getIo = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized.');
  }

  return io;
};
