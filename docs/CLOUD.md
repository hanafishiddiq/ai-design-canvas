# Self-hosted Cloud Projects

AI Design Canvas remains local-first. Cloud projects are optional copies with authenticated users, roles and optimistic revisions.

## Start

```bash
ADC_CLOUD_SECRET="<long-random-secret>" \
ADC_CLOUD_ALLOW_ORIGIN="http://localhost:3000" \
npm run cloud:server
```

Default bind address is `127.0.0.1:8790`. Bind publicly only behind TLS/reverse proxy:

```bash
ADC_CLOUD_HOST=0.0.0.0
ADC_CLOUD_STATE_FILE=/var/lib/ai-design-canvas/cloud.json
ADC_CLOUD_ALLOW_ORIGIN=https://your-frontend.example
```

## Security

- Passwords are hashed with Node `scrypt` and per-user random salts.
- Session bearer tokens are HMAC-signed and expire.
- The browser stores session tokens only in `sessionStorage`.
- First-user bootstrap registration is permitted; subsequent registration requires `ADC_CLOUD_ALLOW_REGISTRATION=true`.
- Login attempts are rate-limited in memory.
- Project roles are `owner`, `editor`, `viewer`.
- Writes use optimistic integer revisions; stale saves return HTTP 409 instead of overwriting newer cloud state.
- Configure TLS and a persistent `ADC_CLOUD_SECRET` before public exposure.

## Local-first ownership

Deleting a cloud project does not delete local/exported copies. The portable `.adc.json` bundle remains the durable vendor-neutral escape hatch.
