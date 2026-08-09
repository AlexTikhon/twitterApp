const assert = require('node:assert/strict');
const http = require('node:http');
const { Writable } = require('node:stream');
const { after, before, test } = require('node:test');

const express = require('express');

const { createHttpLogger, createLogger } = require('../observability/logger');

let baseUrl;
let logLines = '';
let server;

before(async () => {
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      logLines += chunk.toString();
      callback();
    }
  });
  const logger = createLogger({ logLevel: 'info', nodeEnvironment: 'test' }, destination);
  const app = express();
  app.use(createHttpLogger(logger));
  app.get('/ok', (req, res) => res.json({ requestId: req.id }));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

test('HTTP logger preserves a safe incoming request ID in the response and JSON log', async () => {
  const response = await fetch(`${baseUrl}/ok`, {
    headers: { 'X-Request-ID': 'edge-request-123' }
  });
  const body = await response.json();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(response.headers.get('x-request-id'), 'edge-request-123');
  assert.equal(body.requestId, 'edge-request-123');
  const records = logLines
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.ok(records.some((record) => record.req?.id === 'edge-request-123'));
});

test('HTTP logger replaces an unsafe incoming request ID with a UUID', async () => {
  const response = await fetch(`${baseUrl}/ok`, {
    headers: { 'X-Request-ID': 'invalid id with spaces' }
  });
  const requestId = response.headers.get('x-request-id');

  assert.match(requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(requestId, 'invalid id with spaces');
});
