const path = require('node:path');

const dotenv = require('dotenv');

dotenv.config();

const LOCAL_CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

const configurationError = (message) => new Error(`Invalid environment configuration: ${message}`);

const readRequiredString = (env, name) => {
  const value = typeof env[name] === 'string' ? env[name].trim() : '';

  if (!value) {
    throw configurationError(`${name} is required.`);
  }

  return value;
};

const readPositiveInteger = (env, name, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
  if (env[name] === undefined || env[name] === '') {
    return fallback;
  }

  const value = Number(env[name]);

  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw configurationError(`${name} must be an integer between 1 and ${maximum}.`);
  }

  return value;
};

const readNodeEnvironment = (env) => {
  const value = env.NODE_ENV || 'development';

  if (!['development', 'test', 'production'].includes(value)) {
    throw configurationError('NODE_ENV must be development, test, or production.');
  }

  return value;
};

const readCorsOrigins = (env, nodeEnvironment) => {
  const origins = (env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',') : LOCAL_CORS_ORIGINS)
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnvironment === 'production' && !env.CORS_ORIGINS) {
    throw configurationError('CORS_ORIGINS is required in production.');
  }

  if (origins.length === 0) {
    throw configurationError('CORS_ORIGINS must contain at least one origin.');
  }

  const normalizedOrigins = origins.map((origin) => {
    try {
      const parsedOrigin = new URL(origin);

      if (
        !['http:', 'https:'].includes(parsedOrigin.protocol) ||
        parsedOrigin.pathname !== '/' ||
        parsedOrigin.search ||
        parsedOrigin.hash ||
        parsedOrigin.username ||
        parsedOrigin.password
      ) {
        throw new Error('invalid origin');
      }

      return parsedOrigin.origin;
    } catch {
      throw configurationError('CORS_ORIGINS must contain valid HTTP(S) origins.');
    }
  });

  return [...new Set(normalizedOrigins)];
};

const loadConfig = (env = process.env) => {
  const nodeEnvironment = readNodeEnvironment(env);
  const mongodbUri = readRequiredString(env, 'MONGODB_URI');
  const jwtSecret = readRequiredString(env, 'JWT_SECRET');

  if (!/^mongodb(?:\+srv)?:\/\//.test(mongodbUri)) {
    throw configurationError('MONGODB_URI must use mongodb:// or mongodb+srv://.');
  }

  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw configurationError('JWT_SECRET must contain at least 32 bytes.');
  }

  const jsonBodyLimit = (env.JSON_BODY_LIMIT || '1mb').trim();
  if (!/^\d+(?:\.\d+)?(?:b|kb|mb)$/i.test(jsonBodyLimit)) {
    throw configurationError('JSON_BODY_LIMIT must be a size such as 512kb or 8mb.');
  }

  return Object.freeze({
    nodeEnvironment,
    isProduction: nodeEnvironment === 'production',
    port: readPositiveInteger(env, 'PORT', 8080, 65535),
    mongodbUri,
    jwtSecret,
    jwtExpiresInSeconds: readPositiveInteger(env, 'JWT_EXPIRES_IN_SECONDS', 3600),
    jsonBodyLimit,
    corsOrigins: readCorsOrigins(env, nodeEnvironment),
    rateLimit: Object.freeze({
      windowMs: readPositiveInteger(env, 'RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
      apiMax: readPositiveInteger(env, 'RATE_LIMIT_MAX_REQUESTS', 300),
      graphqlMax: readPositiveInteger(env, 'GRAPHQL_RATE_LIMIT_MAX_REQUESTS', 120),
      authMax: readPositiveInteger(env, 'AUTH_RATE_LIMIT_MAX_REQUESTS', 20)
    }),
    posts: Object.freeze({
      defaultPageSize: 2,
      maxPageSize: readPositiveInteger(env, 'POSTS_PAGE_SIZE_LIMIT', 20)
    }),
    graphql: Object.freeze({
      maxDepth: readPositiveInteger(env, 'GRAPHQL_MAX_DEPTH', 8),
      maxComplexity: readPositiveInteger(env, 'GRAPHQL_MAX_COMPLEXITY', 200)
    }),
    storage: Object.freeze({
      imagesDirectory: path.resolve(__dirname, '..', 'images'),
      maxImageSizeBytes: readPositiveInteger(env, 'IMAGE_FILE_SIZE_LIMIT_BYTES', 5 * 1024 * 1024),
      uploadMaxAgeMs: readPositiveInteger(env, 'IMAGE_UPLOAD_MAX_AGE_MS', 24 * 60 * 60 * 1000)
    })
  });
};

module.exports = { loadConfig };
