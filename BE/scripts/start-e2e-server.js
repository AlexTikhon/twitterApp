const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const E2E_JWT_SECRET = 'browser-e2e-test-secret-with-sufficient-length';

let mongoServer;
let stopping = false;

const stop = async (exitCode = 0) => {
  if (stopping) {
    return;
  }

  stopping = true;
  await mongoose.disconnect().catch(() => {});

  if (mongoServer) {
    await mongoServer.stop().catch(() => {});
  }

  process.exit(exitCode);
};

const start = async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET = E2E_JWT_SECRET;
  process.env.PORT = process.env.PORT || '8080';
  process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://127.0.0.1:3000';
  process.env.NODE_ENV = 'test';

  require('../app');
};

process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());

start().catch((error) => {
  console.error('Failed to start the E2E backend:', error);
  void stop(1);
});
