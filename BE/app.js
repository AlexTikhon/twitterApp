// Bootstraps the Express app, GraphQL endpoint, static assets, and socket server.
const path = require('path');
const http = require('http');

const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');
const { parse, visit } = require('graphql');

const isAuth = require('./middleware/is-auth');
const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const socket = require('./socket');

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const port = process.env.PORT || 8080;
const mongoDbUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '8mb';
const isProduction = process.env.NODE_ENV === 'production';
const defaultCorsOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Reads a positive integer env value while falling back to a safe default.
const getPositiveIntegerEnv = (name, fallback) => {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const rateLimitWindowMs = getPositiveIntegerEnv(
  'RATE_LIMIT_WINDOW_MS',
  15 * 60 * 1000
);
const apiRateLimitMax = getPositiveIntegerEnv(
  'RATE_LIMIT_MAX_REQUESTS',
  300
);
const graphqlRateLimitMax = getPositiveIntegerEnv(
  'GRAPHQL_RATE_LIMIT_MAX_REQUESTS',
  120
);
const authRateLimitMax = getPositiveIntegerEnv(
  'AUTH_RATE_LIMIT_MAX_REQUESTS',
  20
);

// Builds the trusted browser origins list from env with local Vite defaults.
const getAllowedCorsOrigins = () =>
  (process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : defaultCorsOrigins
  )
    .map(origin => origin.trim())
    .filter(Boolean);

const allowedCorsOrigins = getAllowedCorsOrigins();

const createRateLimiter = (max, message) =>
  rateLimit({
    windowMs: rateLimitWindowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => req.method === 'OPTIONS' || req.path === '/health',
    message: {
      message,
      data: null
    }
  });

const apiRateLimiter = createRateLimiter(
  apiRateLimitMax,
  'Too many requests. Please try again later.'
);
const graphqlRateLimiter = createRateLimiter(
  graphqlRateLimitMax,
  'Too many GraphQL requests. Please try again later.'
);
const authRateLimiter = createRateLimiter(
  authRateLimitMax,
  'Too many authentication attempts. Please try again later.'
);

// Detects auth root fields without relying on a caller-controlled operation name.
const isAuthOperation = req => {
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
  } catch (error) {
    return false;
  }
};

const authRateLimitMiddleware = (req, res, next) =>
  isAuthOperation(req) ? authRateLimiter(req, res, next) : next();

// Allows same-origin/server-to-server requests and rejects unknown browser origins.
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const error = new Error('Origin is not allowed by CORS.');
    error.statusCode = 403;
    callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(apiRateLimiter);
// Helmet and compression are applied before the API handlers so every response
// gets the security headers and compression settings consistently.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(compression());
app.use(express.json({ limit: jsonBodyLimit }));
app.use(isAuth);
app.use('/images', express.static(path.join(__dirname, 'images')));

// Reports that the API process is alive.
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'API is running' });
});

// Sends a JSON response for routes that are not handled by the API.
const notFoundHandler = (req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

// Normalizes thrown Express errors into the API error response shape.
const errorHandler = (error, req, res, next) => {
  const status = error.statusCode || error.status || 500;
  const message = error.message || 'Internal server error';
  const data = error.data || null;

  res.status(status).json({
    message,
    data
  });
};

if (!mongoDbUri) {
  throw new Error('MONGODB_URI is missing. Add it to your .env file.');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is missing. Add it to your .env file.');
}

// The HTTP server is shared with Socket.IO so GraphQL and realtime updates use
// the same origin and port.
const startServer = async () => {
  try {
    await mongoose.connect(mongoDbUri);
		console.log('MongoDB connected successfully');

    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      // Keeps GraphQL errors compatible with the existing frontend error handling.
      formatError(formattedError, error) {
        const originalError = error.originalError || {};
        const status = originalError.statusCode || 500;

        if (status >= 500) {
          console.error('Unhandled GraphQL error:', error);
        }

        return {
          message:
            status >= 500
              ? 'Internal server error.'
              : originalError.message || formattedError.message,
          status,
          data: status >= 500 ? null : originalError.data || null
        };
      }
    });

    await apolloServer.start();

    // GraphQL is the single API entrypoint for auth, feed, and profile status.
    app.use(
      '/graphql',
      authRateLimitMiddleware,
      graphqlRateLimiter,
      expressMiddleware(apolloServer, {
        // Makes the authenticated Express request available to all resolvers.
        context: async ({ req }) => ({ req })
      })
    );

    app.use(notFoundHandler);
    app.use(errorHandler);

    const io = socket.init(server, allowedCorsOrigins);

    // Logs new realtime clients so socket connectivity is visible during dev.
    io.on('connection', client => {
      console.log(`Socket client connected: ${client.id}`);
    });

    // Starts the shared HTTP server used by Express and Socket.IO.
    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error('Server startup failed:', err.message);
    process.exitCode = 1;
  }
};

startServer();
