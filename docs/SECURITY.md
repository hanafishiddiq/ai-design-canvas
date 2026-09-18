# API Security

Public deployments use conservative request guards.

## AI routes

`/api/ai/edit`, `/api/vision/reference`, and `/api/ai/visual-qa`:

- allow same-origin browser requests by default;
- support optional cross-origin trusted callers with `ADC_API_TOKEN`;
- optionally allow explicit browser origins through `ADC_API_ALLOW_ORIGINS`;
- enforce body-size limits and best-effort per-instance IP rate limits.

The rate limiter is intentionally dependency-free and protects a single warm runtime instance. Internet-scale deployments should add an upstream/global limiter (gateway, WAF, Redis, etc.).

## MCP route

Remote/no-Origin MCP clients should configure:

```bash
ADC_MCP_TOKEN="<strong-random-token>"
```

and send `Authorization: Bearer <token>`.

Browser origins may be allowlisted with comma-separated `ADC_MCP_ALLOW_ORIGINS`.

## Global headers

The Next.js app emits nosniff, restrictive referrer/permissions policies, frame denial via CSP, and COOP. A deliberately minimal CSP is used because the application currently relies on framework-managed scripts/styles and direct localhost bridges; hardening to nonce-based script/style CSP can be added once all runtime injection requirements are enumerated.
