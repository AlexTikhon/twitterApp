const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');

const { createShutdownController } = require('../lifecycle');

const silentLogger = {
  error() {},
  fatal() {},
  info() {}
};

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

test('shutdown is idempotent and closes HTTP, Socket.IO, Apollo, MongoDB, and monitoring', async () => {
  const calls = [];
  const server = http.createServer((_req, res) => res.end('ok'));
  await listen(server);
  const controller = createShutdownController({
    apolloServer: { stop: async () => calls.push('apollo') },
    errorMonitor: {
      capture() {},
      flush: async () => calls.push('monitor')
    },
    io: { close: (callback) => (calls.push('socket'), callback()) },
    logger: silentLogger,
    mongo: { disconnect: async () => calls.push('mongo') },
    server,
    setReady: (ready) => calls.push(`ready:${ready}`),
    timeoutMs: 1000
  });

  const firstStop = controller.stop('test');
  const secondStop = controller.stop('duplicate');
  assert.strictEqual(firstStop, secondStop);
  assert.deepEqual(await firstStop, { forced: false });
  assert.equal(server.listening, false);
  assert.ok(calls.includes('ready:false'));
  assert.ok(calls.includes('socket'));
  assert.ok(calls.includes('apollo'));
  assert.ok(calls.includes('mongo'));
  assert.ok(calls.includes('monitor'));
});

test('shutdown reports a forced result when a component exceeds the deadline', async () => {
  const server = http.createServer((_req, res) => res.end('ok'));
  await listen(server);
  const controller = createShutdownController({
    apolloServer: { stop: () => new Promise(() => {}) },
    errorMonitor: { capture() {}, flush: async () => true },
    io: { close: (callback) => callback() },
    logger: silentLogger,
    mongo: { disconnect: async () => {} },
    server,
    setReady() {},
    timeoutMs: 20
  });

  assert.deepEqual(await controller.stop('timeout-test'), { forced: true });
});
