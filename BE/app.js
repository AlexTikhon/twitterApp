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
const { createShutdownController } = require('./lifecycle');
const { createErrorMonitor, normalizeError } = require('./observability/error-monitor');
const { createBootstrapLogger, createHttpLogger, createLogger } = require('./observability/logger');
const socket = require('./socket');

const createRateLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS' || req.path.startsWith('/health'),
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID']
});

const getErrorStatus = (formattedError, error) => {
  const originalError = error.originalError || {};
  const isValidationError = formattedError.extensions?.code === 'GRAPHQL_VALIDATION_FAILED';
  return originalError.statusCode || (isValidationError ? 400 : 500);
};

const formatGraphqlError = (formattedError, error) => {
  const originalError = error.originalError || {};
  const status = getErrorStatus(formattedError, error);

  return {
    message:
      status >= 500 ? 'Internal server error.' : originalError.message || formattedError.message,
    status,
    data: status >= 500 ? null : originalError.data || null
  };
};

const createGraphqlErrorPlugin = (errorMonitor) => ({
  async requestDidStart() {
    return {
      async didEncounterErrors({ contextValue, errors, operationName }) {
        for (const error of errors) {
          const formattedError = error.toJSON ? error.toJSON() : error;
          if (getErrorStatus(formattedError, error) < 500) {
            continue;
          }

          const requestId = contextValue?.req?.id;
          const applicationError = error.originalError || error;
          contextValue?.req?.log?.error(
            { err: applicationError, operationName },
            'Unhandled GraphQL error'
          );
          errorMonitor.capture(applicationError, {
            requestId,
            operationName,
            userId: contextValue?.req?.userId
          });
        }
      }
    };
  }
});

const startServer = async ({ env = process.env, loggerDestination } = {}) => {
  const config = loadConfig(env);
  const logger = createLogger(config, loggerDestination);
  const errorMonitor = createErrorMonitor(config);
  const app = express();
  const server = http.createServer(app);
  const dependencies = createDependencies(config, mongoose.connection, logger);
  let isReady = false;
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

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(createHttpLogger(logger));
  app.use(cors(createCorsOptions(config.corsOrigins)));
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

  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'alive' });
  });
  app.get(['/health', '/health/ready'], (_req, res) => {
    const ready = isReady && mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });

  let apolloServer;
  let io;
  let shutdown;

  try {
    await mongoose.connect(config.mongodbUri);
    logger.info('MongoDB connected successfully');

    apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      validationRules: createValidationRules(config.graphql),
      formatError: formatGraphqlError,
      plugins: [createGraphqlErrorPlugin(errorMonitor)]
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
    app.use((error, req, res, _next) => {
      const status = error.code?.startsWith('LIMIT_')
        ? 413
        : error.statusCode || error.status || 500;
      if (status >= 500) {
        req.log.error({ err: error }, 'Unhandled HTTP error');
        errorMonitor.capture(error, { requestId: req.id, userId: req.userId });
      }
      res.status(status).json({
        message: status >= 500 ? 'Internal server error' : error.message,
        data: status >= 500 ? null : error.data || null,
        requestId: req.id
      });
    });

    io = socket.init(server, {
      allowedOrigins: config.corsOrigins,
      jwtSecret: config.jwtSecret
    });
    io.on('connection', (client) => {
      logger.info({ socketId: client.id, userId: client.data.userId }, 'Socket client connected');
    });

    shutdown = createShutdownController({
      apolloServer,
      errorMonitor,
      io,
      logger,
      mongo: mongoose,
      server,
      setReady: (ready) => {
        isReady = ready;
      },
      timeoutMs: config.shutdownTimeoutMs
    });

    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, () => {
        server.off('error', reject);
        resolve();
      });
    });
    isReady = true;
    logger.info(
      { port: config.port, errorMonitoringEnabled: errorMonitor.enabled },
      'Server started'
    );

    return { app, errorMonitor, io, logger, server, stop: shutdown.stop };
  } catch (error) {
    isReady = false;
    logger.fatal({ err: error }, 'Server startup failed');
    errorMonitor.capture(error, { phase: 'startup' });

    if (shutdown) {
      await shutdown.stop('startup-failure');
    } else {
      const cleanup = [];
      if (io) {
        cleanup.push(new Promise((resolve) => io.close(resolve)));
      }
      if (apolloServer) {
        cleanup.push(apolloServer.stop());
      }
      if (mongoose.connection.readyState !== 0) {
        cleanup.push(mongoose.disconnect());
      }
      await Promise.allSettled(cleanup);
      await errorMonitor.flush(2000).catch(() => false);
    }

    throw error;
  }
};

if (require.main === module) {
  const bootstrapLogger = createBootstrapLogger();
  let runtime;
  let shutdownRequested = false;
  let pendingShutdown;

  const finishShutdown = async ({ reason, exitCode, error }) => {
    if (error) {
      const normalizedError = normalizeError(error);
      runtime.logger.fatal({ err: normalizedError, reason }, 'Fatal process error');
      runtime.errorMonitor.capture(normalizedError, { phase: 'process', reason });
    }

    const result = await runtime.stop(reason);
    process.exitCode = result.forced ? 1 : exitCode;

    if (result.forced) {
      process.exit(1);
    }
  };

  const requestShutdown = async (reason, exitCode = 0, error) => {
    if (shutdownRequested) {
      bootstrapLogger.fatal({ reason }, 'Second shutdown request received; exiting immediately');
      process.exit(1);
    }
    shutdownRequested = true;
    pendingShutdown = { reason, exitCode, error };

    if (error && !runtime) {
      bootstrapLogger.fatal(
        { err: normalizeError(error), reason },
        'Fatal process error during startup'
      );
    }
    if (runtime) {
      await finishShutdown(pendingShutdown);
    }
  };

  process.once('SIGINT', () => void requestShutdown('SIGINT'));
  process.once('SIGTERM', () => void requestShutdown('SIGTERM'));
  process.once('uncaughtException', (error) => void requestShutdown('uncaughtException', 1, error));
  process.once(
    'unhandledRejection',
    (error) => void requestShutdown('unhandledRejection', 1, error)
  );

  startServer()
    .then(async (startedRuntime) => {
      runtime = startedRuntime;
      if (pendingShutdown) {
        await finishShutdown(pendingShutdown);
      }
    })
    .catch((error) => {
      bootstrapLogger.fatal({ err: error }, 'Server startup failed');
      process.exitCode = 1;
    });
}

module.exports = { createCorsOptions, formatGraphqlError, startServer };
