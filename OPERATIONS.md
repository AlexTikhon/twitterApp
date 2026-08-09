# Production operations

## Health and shutdown

- `GET /health/live` confirms that the Node.js process is alive.
- `GET /health/ready` (and the compatibility endpoint `GET /health`) returns `200` only after MongoDB, Apollo, Socket.IO, and HTTP startup has completed.
- `SIGTERM` and `SIGINT` stop accepting HTTP traffic, close Socket.IO and Apollo, disconnect MongoDB, and flush error monitoring. `SHUTDOWN_TIMEOUT_MS` defaults to 10 seconds; a timeout forces open connections closed and exits unsuccessfully.
- Compose allows 15 seconds before sending `SIGKILL`, so keep `SHUTDOWN_TIMEOUT_MS` below that value.

## Logs and error monitoring

The backend writes newline-delimited JSON to stdout. Set `LOG_LEVEL` to `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`. Every HTTP response has an `X-Request-ID`; a valid incoming ID is preserved, otherwise the backend generates a UUID. Authorization and cookie headers are not logged.

Set `SENTRY_DSN` to enable Sentry error delivery. `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` are optional. Without a DSN, 5xx and fatal errors remain visible in JSON logs and the application has no external monitoring dependency.

## Backups

The backup scripts require Docker plus the matching MongoDB Database Tools (`mongodump` and `mongorestore`) on the operator machine. Use a MongoDB account with only the privileges needed for backup/restore. The scripts intentionally stop the single backend container so the MongoDB dump and local image volume form one consistent application snapshot.

Create a backup:

```powershell
.\ops\Backup.ps1 -MongoUri $env:MONGODB_URI
```

The result is written under `backups/<UTC timestamp>/` and contains a gzip MongoDB archive, all images, and a manifest with the archive SHA-256. Copy the completed directory to encrypted off-host storage, apply a retention policy, and schedule regular restore drills. A local directory on the same machine is not a complete backup strategy.

Restore is destructive and requires an explicit confirmation switch. Create a fresh safety backup first, then run:

```powershell
.\ops\Restore.ps1 `
  -BackupDirectory .\backups\20260809T120000Z `
  -MongoUri $env:MONGODB_URI `
  -ConfirmDataReplacement
```

Use the same MongoDB Database Tools version for dump and restore and restore to a compatible MongoDB server version. After restore, verify `/health/ready`, login, feed reads, and several image URLs.

## Scaling boundary

This deployment remains deliberately single-instance. Local images and Socket.IO's in-memory adapter are correct only for one backend. Before scaling horizontally, move images to shared object storage and configure a Redis-compatible Socket.IO adapter; perform that migration as one coordinated change.
