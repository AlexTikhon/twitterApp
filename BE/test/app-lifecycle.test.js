const assert = require('node:assert/strict');
const http = require('node:http');
const { Writable } = require('node:stream');
const { test } = require('node:test');

const { MongoMemoryServer } = require('mongodb-memory-server');

const { startServer } = require('../app');

const reservePort = async () => {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

test('running application becomes ready, returns a request ID, and stops cleanly', async () => {
  const mongoServer = await MongoMemoryServer.create();
  const port = await reservePort();
  const logDestination = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
  let runtime;

  try {
    runtime = await startServer({
      env: {
        MONGODB_URI: mongoServer.getUri(),
        JWT_SECRET: 'application-lifecycle-test-secret-with-sufficient-length',
        NODE_ENV: 'test',
        PORT: String(port)
      },
      loggerDestination: logDestination
    });

    const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ready' });
    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);

    assert.deepEqual(await runtime.stop('integration-test'), { forced: false });
    assert.equal(runtime.server.listening, false);
  } finally {
    if (runtime?.server.listening) {
      await runtime.stop('test-cleanup');
    }
    await mongoServer.stop();
  }
});
