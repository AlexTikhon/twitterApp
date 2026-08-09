const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadConfig } = require('../config');

const validEnv = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/twitter-test',
  JWT_SECRET: 'configuration-test-secret-with-32-bytes',
  NODE_ENV: 'test'
};

test('configuration parses bounded values into one validated object', () => {
  const config = loadConfig({
    ...validEnv,
    PORT: '9090',
    POSTS_PAGE_SIZE_LIMIT: '50',
    CORS_ORIGINS: 'https://example.com/,https://admin.example.com'
  });

  assert.equal(config.port, 9090);
  assert.equal(config.posts.maxPageSize, 50);
  assert.equal(config.graphql.maxDepth, 8);
  assert.equal(config.graphql.maxComplexity, 200);
  assert.deepEqual(config.corsOrigins, ['https://example.com', 'https://admin.example.com']);
});

test('configuration fails fast when required secrets are missing or weak', () => {
  assert.throws(() => loadConfig({ ...validEnv, JWT_SECRET: '' }), /JWT_SECRET is required/);
  assert.throws(() => loadConfig({ ...validEnv, JWT_SECRET: 'too-short' }), /at least 32 bytes/);
});

test('configuration requires explicit browser origins in production', () => {
  assert.throws(
    () => loadConfig({ ...validEnv, NODE_ENV: 'production' }),
    /CORS_ORIGINS is required in production/
  );
});

test('configuration rejects malformed optional numeric values', () => {
  assert.throws(() => loadConfig({ ...validEnv, PORT: 'not-a-port' }), /PORT must be an integer/);
});
