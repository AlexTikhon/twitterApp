const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');
const { io: createClient } = require('socket.io-client');

const { PostRealtime } = require('../realtime/post-realtime');
const realtime = require('../socket');

const waitFor = (client, event) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2500);

    client.once(event, (value) => {
      clearTimeout(timeout);
      resolve(value);
    });
  });

test('Socket.IO rejects anonymous clients and accepts a valid JWT', async () => {
  const jwtSecret = 'isolated-socket-test-secret-with-sufficient-length';

  const server = http.createServer();
  const io = realtime.init(server, {
    allowedOrigins: ['http://localhost'],
    jwtSecret
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}`;
    const anonymous = createClient(url, {
      forceNew: true,
      reconnection: false,
      transports: ['websocket']
    });
    const authError = await waitFor(anonymous, 'connect_error');
    anonymous.close();

    assert.equal(authError.message, 'Not authenticated.');

    const token = jwt.sign({ userId: '507f1f77bcf86cd799439011' }, jwtSecret, {
      expiresIn: '1m'
    });
    const authenticated = createClient(url, {
      auth: { token },
      forceNew: true,
      reconnection: false,
      transports: ['websocket']
    });

    await waitFor(authenticated, 'connect');
    authenticated.close();
  } finally {
    await io.close();
  }
});

test('Socket.IO stops delivering post events once the admitting JWT expires', async () => {
  const jwtSecret = 'isolated-socket-test-secret-with-sufficient-length';
  const server = http.createServer();
  const io = realtime.init(server, { allowedOrigins: ['http://localhost'], jwtSecret });
  const postRealtime = new PostRealtime({
    postRepository: {},
    broadcast: realtime.emitToAuthorized
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const clients = [];
  const connect = (url, token) => {
    const client = createClient(url, {
      auth: { token },
      forceNew: true,
      reconnection: false,
      transports: ['websocket']
    });
    clients.push(client);
    return client;
  };

  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const userId = '507f1f77bcf86cd799439011';
    const shortLived = connect(url, jwt.sign({ userId }, jwtSecret, { expiresIn: 1 }));
    const longLived = connect(url, jwt.sign({ userId }, jwtSecret, { expiresIn: '1m' }));
    await Promise.all([waitFor(shortLived, 'connect'), waitFor(longLived, 'connect')]);

    const received = { shortLived: [], longLived: [] };
    shortLived.on('posts', (event) => received.shortLived.push(event.post._id));
    longLived.on('posts', (event) => received.longLived.push(event.post._id));
    // A client that never disconnects voluntarily must still be cut off.
    const disconnected = waitFor(shortLived, 'disconnect');

    await postRealtime.emit('delete', 'before-expiry');
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(received.shortLived, ['before-expiry']);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    // Even if the disconnect timer lagged, a broadcast must not reach an expired socket.
    await postRealtime.emit('delete', 'after-expiry');
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(await disconnected, 'io server disconnect');
    assert.deepEqual(received.shortLived, ['before-expiry']);
    assert.deepEqual(received.longLived, ['before-expiry', 'after-expiry']);
    assert.equal(io.of('/').sockets.size, 1);
  } finally {
    clients.forEach((client) => client.close());
    await io.close();
  }
});
