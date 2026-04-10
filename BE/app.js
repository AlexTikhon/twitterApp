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
const { graphqlHTTP } = require('express-graphql');

const isAuth = require('./middleware/is-auth');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const socket = require('./socket');

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;
const mongoDbUri = process.env.MONGODB_URI;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
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

app.get('/health', (req, res) => {
  res.status(200).json({ message: 'API is running' });
});

// GraphQL becomes the single API entrypoint for auth, feed, and profile status.
app.use(
  '/graphql',
  graphqlHTTP(req => ({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    context: req,
    customFormatErrorFn(error) {
      const originalError = error.originalError || {};

      return {
        message: originalError.message || error.message,
        status: originalError.statusCode || 500,
        data: originalError.data || null
      };
    }
  }))
);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  const data = error.data || null;

  res.status(status).json({
    message,
    data
  });
});

if (!mongoDbUri) {
  throw new Error('MONGODB_URI is missing. Add it to your .env file.');
}

// The HTTP server is shared with Socket.IO so GraphQL and realtime updates use
// the same origin and port.
const startServer = async () => {
  try {
    await mongoose.connect(mongoDbUri);
    const io = socket.init(server);

    io.on('connection', client => {
      console.log(`Socket client connected: ${client.id}`);
    });

    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err);
  }
};

startServer();
