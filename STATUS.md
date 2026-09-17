# AI Design Canvas — Current Status

This file is a short, frequently updated checkpoint. For the long-term target, read `AGENTS.md`, `docs/VISION.md`, `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md`.

## Current schema

**Project schema v5** is the current durable project contract.

It includes:

- structured pages/nodes/flows;
- auto-layout and responsive constraints;
- components/instances;
- variable collections and modes;
- embedded visual references;
- portable review threads/status;
- design↔code mappings;
- `DESIGN.md`;
- migration from legacy v1–v4 projects.

## Working product layers

### Structured editor

Implemented at MVP/strong-foundation level:

- Studio v2 structured canvas;
- layers, selection/multi-selection, move, resize, duplicate/delete;
- reversible operation/history core and undo/redo;
- semantic auto-layout;
- responsive constraints + viewport preview;
- reusable component/instance primitives;
- design variables/themes;
- prototype flows;
- deterministic persistence/checkpoints;
- Anti-Slop/accessibility/cross-screen audit.

### Design intelligence / multimodal

Implemented:

- curated foundation/style mixer;
- `DESIGN.md` round-trip;
- local screenshot/sketch/reference analysis;
- semantic draft generation without an API key;
- optional server-side hosted vision using structured output;
- bounded AI Edit proposal → preview → Apply/Reject flow.

### OpenPencil

Implemented foundation:

- canonical PenNode conversion;
- upstream-compatible MCP HTTP client;
- `set_design_md`, variables, components and screens sync through official OpenPencil tools;
- OpenPencil connector UI.

Real native/headless interoperability should still be tested against a running upstream OpenPencil instance for loss reports and bidirectional patch fidelity before this area is called complete.

### Review/versioning

Implemented foundation:

- durable page/node anchored review threads;
- replies;
- resolve/reopen;
- review status (`draft`, `in-review`, `changes-requested`, `approved`);
- local automatic recovery checkpoints and restore UI.

Cloud identity/permissions and real multi-user review remain future work.

### Design ↔ code

Implemented foundation:

- semantic React and HTML generation;
- stable `data-page-id` / `data-node-id` instrumentation;
- portable page/node/component ↔ code mapping metadata;
- runtime manifest capture;
- page-relative geometry/content/style/visibility QA;
- Roundtrip panel and QA score/issues;
- deterministic project serialization + SHA-256 fingerprint;
- portable `.adc.json` bundle import/export.

Still required for complete round-trip:

- repository discovery/import;
- source-aware selective updates;
- safe mapping repair;
- screenshot/pixel visual diff layer;
- targeted coding-agent fixes and CI integration.

### Agent/headless

Implemented foundation:

- stateless project tools for migrate/validate/operations/audit/codegen/OpenPencil conversion/summary;
- MCP-compatible HTTP route;
- repository instructions for Codex/Claude/Gemini/Copilot.

The public/headless surface still needs stronger authentication, version negotiation, exhaustive operation schemas and external-client integration tests.

### Collaboration

Implemented foundation:

- provider-neutral collaboration operation envelope;
- presence model;
- local `BroadcastChannel` transport;
- HTTP/SSE transport;
- self-hosted Node collaboration relay (`npm run collab:relay`);
- optional token, CORS origin, snapshot bootstrap and disk snapshot persistence.

**Important current gate:** transport exists, but Studio operation history is not yet wired directly to collaboration publish/apply. Do not call collaboration complete until remote edits can apply without page reload and conflict/reconnect behavior is tested.

## Deployment state

The Git-linked Vercel project has previously produced healthy READY production builds. At the time this status was written, newer commits are being rejected by Vercel with a **build-rate-limit account status**, not a known source-code failure. The last confirmed READY deployment therefore lags behind `main`.

Do not rollback new architecture merely to match the older READY deployment. Re-run full quality gates and deploy current `main` once the Vercel build quota permits.

## Immediate next gates

Work in this order unless a concrete user need overrides it:

1. run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` against current schema v5 once an execution environment is available;
2. fix any compile/test drift and get current `main` back to Vercel READY;
3. wire Studio `commit/undo/redo` to collaboration transport and apply remote operation envelopes without reload;
4. add reconnect/dedupe/conflict handling and managed-cloud auth/permissions adapter;
5. test true OpenPencil headless round-trip against upstream;
6. add source-repository discovery and design↔code mapping repair;
7. add screenshot/pixel visual QA and targeted agent fix loop;
8. add Git/CI workflow and portable project/version review;
9. implement plugin/skill/foundation provider manifests;
10. performance/accessibility/security hardening and large-project tests.

## Definition of progress discipline

A UI button is not completion. A capability should only advance status when its data model, persistence, errors/recovery, tests, interoperability and documentation are appropriate for the claim.
