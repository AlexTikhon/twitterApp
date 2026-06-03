// Creates a single shared Socket.IO instance for the whole backend.
const socketIo = require('socket.io');

let io;

// Creates and stores the shared Socket.IO server instance.
exports.init = (server, allowedOrigins) => {
  io = socketIo(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  });

  return io;
};

// Returns the initialized Socket.IO instance for resolver broadcasts.
exports.getIo = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized.');
  }

  return io;
};
