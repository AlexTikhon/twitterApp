# MessageNode

MessageNode is a deliberately small Twitter-like full-stack project for learning, architecture practice, and Senior Frontend / Full-Stack interviews. It demonstrates production-style boundaries without pretending to be a horizontally scaled social network.

## What it demonstrates

- React 19, TypeScript, Vite, React Router, Apollo Client, generated GraphQL operations, and Socket.IO
- Express, Apollo Server, MongoDB/Mongoose, services, repositories, DataLoader, and JWT authorization
- short text posts with optional images, ownership checks, user profiles, deterministic cursor pagination, and infinite loading
- structured logging, Sentry integration, rate limits, Helmet, readiness/liveness probes, graceful shutdown, Docker, CI, backups, and restore verification
- unit, integration, component, and Playwright end-to-end tests

## Architecture

```text
React
  |
Apollo Client cache
  |
GraphQL
  |
Resolvers
  |
Services
  |
Repositories
  |
MongoDB

Socket.IO -> Apollo cache updates / targeted refetch -> React
```

The backend keeps transport, domain orchestration, and persistence separate: resolvers authorize and delegate, services own use cases and transactions, and repositories contain database queries. This is enough separation to test important behavior without adding speculative layers.

## Architecture decisions

- **GraphQL:** the feed, profiles, authentication, and mutations share one typed contract. GraphQL Code Generator produces `TypedDocumentNode` operations consumed directly by Apollo hooks.
- **Apollo as server state:** React does not keep a second post array. Cursor pages merge through `fetchMore`; mutations update normalized entities or refetch active feed variants when list reconciliation is safer. A create refetch may reset already loaded extra pages, an intentional small-project trade-off that avoids fragile list surgery.
- **Realtime:** one authenticated Socket.IO connection reconciles every route through Apollo. Create events refetch active feed queries, updates write the normalized `Post`, and deletes evict it. The policy is intentionally explicit rather than hidden in complex cache rules.
- **Cursor pagination:** posts are ordered by `createdAt DESC, _id DESC`, backed by a matching compound index. The opaque cursor contains both values, page size is bounded, and malformed cursors fail with a safe 400 error.
- **Images:** an authenticated multipart upload is signature-checked and stored as a temporary upload record. Creating or updating a post consumes that record in the database transaction; replaced/deleted local files are cleaned up after commit. Images are optional.
- **Authentication:** the app keeps a one-hour bearer JWT in browser storage and clears both session and Apollo cache on expiry, logout, or a 401 response. This keeps the learning project simple and Socket.IO authentication direct, but browser storage is exposed if an XSS vulnerability exists. A commercial system should prefer Secure, HttpOnly, SameSite cookies plus a deliberate CSRF/refresh strategy. Authorization and ownership are always enforced on the server; tokens and credentials are not logged.
- **Single-instance deployment:** local image storage and the in-process Socket.IO adapter deliberately constrain production deployment to one backend instance. Docker Compose is hardened for that boundary.

## Scaling boundary

Horizontal scaling would require approximately:

- object storage for images;
- a shared Socket.IO adapter such as Redis;
- an external/shared production MongoDB deployment.

Those components are intentionally documented, not implemented.

## Running locally

Requirements: Node.js 24 and MongoDB.

Backend (PowerShell):

```powershell
cd BE
npm ci
Copy-Item .env.example .env
# Set a real MONGODB_URI and a random JWT_SECRET of at least 32 bytes in .env
npm run dev
```

Frontend, in a second terminal:

```powershell
cd FE
npm ci
npm run codegen
npm run dev
```

Open `http://localhost:3000`. To run the production-style stack instead, prepare `BE/.env` and run:

```powershell
docker compose up --build
```

The Compose frontend is available on `http://localhost`.

## Testing strategy

- **Unit:** validation, cursor codec, image storage, logging, lifecycle, and service transaction behavior.
- **Integration:** the real GraphQL schema, MongoDB replica-set transactions, authentication, ownership, optional images, profiles, deterministic pagination, malformed cursors, and DataLoader batching.
- **Frontend:** session behavior, permissions, realtime deduplication, Apollo-backed pages, and form validators.
- **E2E:** signup -> login -> create -> profile/view -> edit -> ownership rejection -> delete, plus infinite cursor loading.

Run the same checks as CI:

```powershell
cd BE
npm run lint
npm run format:check
npm test

cd ../FE
npm run codegen
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e

cd ..
docker compose build
```

Operational backup and restore procedures are documented in [OPERATIONS.md](./OPERATIONS.md).
