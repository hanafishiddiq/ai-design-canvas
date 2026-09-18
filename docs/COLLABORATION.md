# Collaboration architecture

AI Design Canvas treats collaboration as a transport concern over the same typed design operations used by the editor and agents.

## Modes

### Local realtime

`BroadcastCollaborationTransport` uses `BroadcastChannel` to exchange typed operation envelopes and presence across browser tabs/windows. It is useful for development and proves the collaboration contract without a backend.

### Self-hosted realtime relay

Run:

```bash
npm run collab:relay
```

Defaults:

- host: `0.0.0.0`
- port: `8787`
- in-memory rooms
- optional disk-persisted latest snapshots

Recommended environment:

```bash
COLLAB_PORT=8787
COLLAB_TOKEN=replace-with-a-long-random-secret
COLLAB_ALLOW_ORIGIN=https://your-ai-design-canvas.example
COLLAB_DATA_DIR=/var/lib/ai-design-canvas-collab
npm run collab:relay
```

Do not expose a tokenless relay directly to the public internet.

The relay exposes:

- `GET /health`
- `GET /events` — Server-Sent Events stream
- `GET /snapshot`
- `POST /snapshot`
- `POST /operations`
- `POST /presence`

`HttpSseCollaborationTransport` implements the same collaboration interface as the local transport.

## Operation envelope

```text
roomId
projectId
clientId
sequence
baseUpdatedAt
createdAt
operations[]
```

Operations are bounded to 200 per envelope. Incoming operations are applied through the same `applyOperation()` code path and revalidated against the project schema.

## Source-of-truth rules

- The design document remains authoritative for design state.
- Presence is ephemeral and is not stored inside the project.
- Review threads are durable project data and travel with exports/Git.
- Cloud transports must not introduce a second incompatible document model.
- A relay may persist the latest project snapshot for bootstrap, but edits still travel as typed operations.

## Future managed-cloud adapter

A managed cloud deployment may replace the relay with Supabase, Redis/WebSocket, Durable Objects, or another service. It must implement the same semantic contract:

1. durable project snapshot;
2. ordered operation delivery;
3. presence;
4. authorization/permissions;
5. reconnect/replay or conflict recovery;
6. export/local ownership preserved.

This keeps collaboration provider-neutral and self-hostable.


## Scoped viewer/editor tokens

For public or semi-trusted deployments, prefer `COLLAB_SECRET` over a single shared editor token.

Generate an editor token:

```bash
COLLAB_SECRET="<strong-secret>" npm run collab:token -- --project <project-id> --role editor --ttl-hours 24
```

Generate a read/review token:

```bash
COLLAB_SECRET="<strong-secret>" npm run collab:token -- --project <project-id> --role viewer --ttl-hours 24
```

Tokens are HMAC-SHA256 signed and may be scoped to a project, optional room, role, name and expiration. The relay enforces:

- **viewer**: event stream, presence and snapshot reads;
- **editor**: viewer rights plus operations and snapshot writes;
- **admin/static token**: unrestricted relay access.

The web UI stores the collaboration token in `sessionStorage`, not persistent `localStorage`.
