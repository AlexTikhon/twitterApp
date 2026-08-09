const closeHttpServer = (server) =>
  new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => (error ? reject(error) : resolve()));
  });

const closeSocketServer = (io) =>
  new Promise((resolve) => {
    io.close(() => resolve());
  });

const createShutdownController = ({
  apolloServer,
  errorMonitor,
  io,
  logger,
  mongo,
  server,
  setReady,
  timeoutMs
}) => {
  const sockets = new Set();
  let stopPromise;

  server.on('connection', (connection) => {
    sockets.add(connection);
    connection.once('close', () => sockets.delete(connection));
  });

  const forceClose = () => {
    server.closeAllConnections?.();
    for (const connection of sockets) {
      connection.destroy();
    }
  };

  const stop = (reason = 'manual') => {
    if (stopPromise) {
      return stopPromise;
    }

    stopPromise = (async () => {
      setReady(false);
      logger.info({ reason, timeoutMs }, 'Graceful shutdown started');

      const shutdownWork = (async () => {
        const httpClose = closeHttpServer(server);
        const results = await Promise.allSettled([
          httpClose,
          closeSocketServer(io),
          apolloServer.stop()
        ]);

        await mongo.disconnect();
        await errorMonitor.flush(Math.min(timeoutMs, 2000));

        const failures = results.filter((result) => result.status === 'rejected');
        if (failures.length > 0) {
          throw new AggregateError(
            failures.map((failure) => failure.reason),
            'One or more server components failed to stop.'
          );
        }
      })();

      let timer;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      });
      const outcome = await Promise.race([shutdownWork.then(() => 'stopped'), timeout]).finally(
        () => clearTimeout(timer)
      );

      if (outcome === 'timeout') {
        forceClose();
        logger.fatal({ reason, timeoutMs }, 'Graceful shutdown timed out; connections destroyed');
        return { forced: true };
      }

      logger.info({ reason }, 'Graceful shutdown completed');
      return { forced: false };
    })().catch(async (error) => {
      forceClose();
      logger.error({ err: error, reason }, 'Graceful shutdown failed');
      errorMonitor.capture(error, { phase: 'shutdown', reason });
      await errorMonitor.flush(2000).catch(() => false);
      return { forced: true, error };
    });

    return stopPromise;
  };

  return { stop };
};

module.exports = { closeHttpServer, createShutdownController };
