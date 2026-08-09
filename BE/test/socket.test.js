const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');
const { io: createClient } = require('socket.io-client');

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
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-socket-test-secret-with-sufficient-length';

  const server = http.createServer();
  const io = realtime.init(server, ['http://localhost']);
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

    const token = jwt.sign({ userId: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, {
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

    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});
