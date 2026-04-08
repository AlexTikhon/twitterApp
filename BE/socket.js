const socketIo = require('socket.io');

let io;

exports.init = server => {
  io = socketIo(server, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
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
