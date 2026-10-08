const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

// setTimeout overflows (and fires immediately) above this delay.
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

const isExpired = (client, now = Date.now()) => client.data.expiresAt <= now;

// Authorization lasts as long as the admitting JWT; the server, not the browser, enforces it.
const scheduleExpiry = (client) => {
  let timer;
  const arm = () => {
    const remaining = client.data.expiresAt - Date.now();
    if (remaining <= 0) {
      client.disconnect(true);
      return;
    }
    timer = setTimeout(arm, Math.min(remaining, MAX_TIMER_DELAY_MS));
    timer.unref();
  };

  client.once('disconnect', () => clearTimeout(timer));
  arm();
};

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

      if (!decodedToken.userId || !Number.isFinite(decodedToken.exp)) {
        return next(new Error('Not authenticated.'));
      }

      client.data.userId = decodedToken.userId;
      client.data.expiresAt = decodedToken.exp * 1000;
      return next();
    } catch {
      return next(new Error('Not authenticated.'));
    }
  });

  // Registered before any application listener so expiry is armed for every admitted socket.
  io.on('connection', scheduleExpiry);

  return io;
};

exports.getIo = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized.');
  }

  return io;
};

// Delivers an application event only to sockets whose JWT is still valid, dropping the rest.
exports.emitToAuthorized = (event, payload) => {
  const now = Date.now();

  for (const client of exports.getIo().sockets.sockets.values()) {
    if (isExpired(client, now)) {
      client.disconnect(true);
    } else {
      client.emit(event, payload);
    }
  }
};
