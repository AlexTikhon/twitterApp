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
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');

const isAuth = require('./middleware/is-auth');
const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const socket = require('./socket');

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;
const mongoDbUri = process.env.MONGODB_URI;
const isProduction = process.env.NODE_ENV === 'production';
const defaultCorsOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Builds the trusted browser origins list from env with local Vite defaults.
const getAllowedCorsOrigins = () =>
  (process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : defaultCorsOrigins
  )
    .map(origin => origin.trim())
    .filter(Boolean);

const allowedCorsOrigins = getAllowedCorsOrigins();

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
// Helmet and compression are applied before the API handlers so every response
// gets the security headers and compression settings consistently.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(compression());
app.use(express.json());
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
  const status = error.statusCode || 500;
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

        return {
          message: originalError.message || formattedError.message,
          status: originalError.statusCode || 500,
          data: originalError.data || null
        };
      }
    });

    await apolloServer.start();

    // GraphQL is the single API entrypoint for auth, feed, and profile status.
    app.use(
      '/graphql',
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
    console.error('MongoDB connection failed:', err);
  }
};

startServer();
