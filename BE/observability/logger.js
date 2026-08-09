const { randomUUID } = require('node:crypto');

const pino = require('pino');
const pinoHttp = require('pino-http');

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

const createLogger = (config, destination) =>
  pino(
    {
      level: config.logLevel,
      base: {
        service: 'twitterapp-backend',
        environment: config.nodeEnvironment
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[Redacted]'
      },
      timestamp: pino.stdTimeFunctions.isoTime
    },
    destination
  );

const createBootstrapLogger = () =>
  pino({
    base: { service: 'twitterapp-backend' },
    timestamp: pino.stdTimeFunctions.isoTime
  });

const createHttpLogger = (logger) =>
  pinoHttp({
    logger,
    quietReqLogger: true,
    genReqId(req, res) {
      const suppliedRequestId = req.headers['x-request-id'];
      const requestId =
        typeof suppliedRequestId === 'string' && REQUEST_ID_PATTERN.test(suppliedRequestId)
          ? suppliedRequestId
          : randomUUID();

      res.setHeader('X-Request-ID', requestId);
      return requestId;
    },
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) {
        return 'error';
      }
      if (res.statusCode >= 400) {
        return 'warn';
      }
      return 'info';
    },
    autoLogging: {
      ignore: (req) => ['/health', '/health/live', '/health/ready'].includes(req.url)
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
          userAgent: req.headers?.['user-agent']
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      }
    },
    customSuccessMessage: () => 'HTTP request completed',
    customErrorMessage: () => 'HTTP request failed'
  });

module.exports = { createBootstrapLogger, createHttpLogger, createLogger };
