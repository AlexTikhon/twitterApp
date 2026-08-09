const http = require('node:http');

const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { parse, visit } = require('graphql');
const helmet = require('helmet');
const mongoose = require('mongoose');
const morgan = require('morgan');

const { loadConfig } = require('./config');
const { createDependencies } = require('./dependencies');
const { createLoaders } = require('./graphql/loaders');
const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const { createValidationRules } = require('./graphql/validation');
const {
  createImageUploadHandler,
  createImageUploadMiddleware,
  requireImageUploadAuth
} = require('./http/image-upload');
const { createAuthMiddleware } = require('./middleware/is-auth');
const socket = require('./socket');

const createRateLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS' || req.path === '/health',
    message: { message, data: null }
  });

const isAuthOperation = (req) => {
  if (typeof req.body?.query !== 'string') {
    return false;
  }

  try {
    const document = parse(req.body.query);
    let containsAuthField = false;

    visit(document, {
      Field(node) {
        if (['login', 'createUser'].includes(node.name.value)) {
          containsAuthField = true;
        }
      }
    });

    return containsAuthField;
  } catch {
    return false;
  }
};

const createCorsOptions = (allowedOrigins) => ({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const error = new Error('Origin is not allowed by CORS.');
    error.statusCode = 403;
    callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

const formatGraphqlError = (formattedError, error) => {
  const originalError = error.originalError || {};
  const isValidationError = formattedError.extensions?.code === 'GRAPHQL_VALIDATION_FAILED';
  const status = originalError.statusCode || (isValidationError ? 400 : 500);

  if (status >= 500) {
    console.error('Unhandled GraphQL error:', error);
  }

  return {
    message:
      status >= 500 ? 'Internal server error.' : originalError.message || formattedError.message,
    status,
    data: status >= 500 ? null : originalError.data || null
  };
};

const startServer = async ({ env = process.env } = {}) => {
  const config = loadConfig(env);
  const app = express();
  const server = http.createServer(app);
  const dependencies = createDependencies(config);
  const { windowMs, apiMax, graphqlMax, authMax } = config.rateLimit;
  const apiRateLimiter = createRateLimiter(
    windowMs,
    apiMax,
    'Too many requests. Please try again later.'
  );
  const graphqlRateLimiter = createRateLimiter(
    windowMs,
    graphqlMax,
    'Too many GraphQL requests. Please try again later.'
  );
  const authRateLimiter = createRateLimiter(
    windowMs,
    authMax,
    'Too many authentication attempts. Please try again later.'
  );

  app.set('trust proxy', 1);
  app.use(cors(createCorsOptions(config.corsOrigins)));
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use(apiRateLimiter);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(createAuthMiddleware(config.jwtSecret));
  app.use('/images', express.static(config.storage.imagesDirectory));

  app.post(
    '/uploads/images',
    requireImageUploadAuth,
    createImageUploadMiddleware(config.storage.maxImageSizeBytes),
    createImageUploadHandler(dependencies.services.imageUploads)
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ message: 'API is running' });
  });

  await mongoose.connect(config.mongodbUri);
  console.log('MongoDB connected successfully');

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    validationRules: createValidationRules(config.graphql),
    formatError: formatGraphqlError
  });
  await apolloServer.start();

  app.use(
    '/graphql',
    (req, res, next) => (isAuthOperation(req) ? authRateLimiter(req, res, next) : next()),
    graphqlRateLimiter,
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        req,
        services: dependencies.services,
        loaders: createLoaders(dependencies.repositories)
      })
    })
  );

  app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });
  app.use((error, _req, res, _next) => {
    const status = error.code?.startsWith('LIMIT_') ? 413 : error.statusCode || error.status || 500;
    if (status >= 500) {
      console.error('Unhandled HTTP error:', error);
    }
    res.status(status).json({
      message: status >= 500 ? 'Internal server error' : error.message,
      data: status >= 500 ? null : error.data || null
    });
  });

  const io = socket.init(server, {
    allowedOrigins: config.corsOrigins,
    jwtSecret: config.jwtSecret
  });
  io.on('connection', (client) => {
    console.log(`Socket client connected: ${client.id}`);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, () => {
      server.off('error', reject);
      resolve();
    });
  });
  console.log(`Server is running on port ${config.port}`);

  const stop = async () => {
    await apolloServer.stop();
    await new Promise((resolve) => io.close(resolve));
    await mongoose.disconnect();
  };

  return { app, server, io, stop };
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
