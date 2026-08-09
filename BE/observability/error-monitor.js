const Sentry = require('@sentry/node');

const normalizeError = (error) =>
  error instanceof Error ? error : new Error(typeof error === 'string' ? error : String(error));

const createErrorMonitor = (config) => {
  const enabled = Boolean(config.sentry.dsn);

  if (enabled) {
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.sentry.environment,
      release: config.sentry.release,
      sendDefaultPii: false,
      tracesSampleRate: 0
    });
  }

  return Object.freeze({
    enabled,
    capture(error, context = {}) {
      if (!enabled) {
        return;
      }

      Sentry.withScope((scope) => {
        if (context.requestId) {
          scope.setTag('request_id', context.requestId);
        }
        if (context.operationName) {
          scope.setTag('graphql.operation', context.operationName);
        }
        if (context.userId) {
          scope.setUser({ id: context.userId });
        }

        scope.setContext('application', context);
        Sentry.captureException(normalizeError(error));
      });
    },
    async flush(timeoutMs = 2000) {
      return enabled ? Sentry.flush(timeoutMs) : true;
    }
  });
};

module.exports = { createErrorMonitor, normalizeError };
