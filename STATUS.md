# AI Design Canvas — Current Status

This file is the short operational checkpoint. For long-term intent read `AGENTS.md`, `docs/VISION.md`, `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md`.

## Current milestone

**Advanced alpha / strong open-source foundation** as of 2026-09-18.

The product is no longer only a proof-of-concept canvas. The core structured editor, multimodal design workflow, OpenPencil bridge, collaboration foundation, optional cloud service, repository-aware round-trip metadata, pixel QA, extensions, security baseline and CI are implemented and tested.

Do **not** interpret this as the final north-star being complete. Important deep-editor/platform gaps are listed below.

## Durable project contract

**Project schema v5** currently includes:

- structured pages, nodes and prototype flows;
- auto-layout + responsive constraints;
- components/instances + instance override metadata;
- variable collections, modes and themes;
- embedded visual references;
- interaction visual states;
- review threads/status;
- design↔code mappings;
- `DESIGN.md`;
- migration from legacy v1–v4;
- deterministic serialization/fingerprint and portable `.adc.json` bundles.

## Implemented product layers

### Structured Studio

- infinite/multi-screen pan + zoom workspace;
- layers, selection/multi-selection and Shift-drag marquee;
- drag/move, resize, duplicate, delete, design clipboard copy/paste;
- align + distribute;
- viewport-based screen culling for larger projects;
- operation-backed undo/redo;
- semantic horizontal/vertical auto-layout;
- fixed/hug/fill sizing and responsive constraints;
- mobile/tablet/desktop responsive preview;
- component definitions, instances, overrides, variables and themes;
- command palette (Ctrl/Cmd+K) for screens/nodes/components;
- keyboard-selectable canvas nodes, focus-visible and reduced-motion support.

### Design intelligence / multimodal

- curated style foundations + style mixer;
- declarative custom foundation extensions;
- first-class `DESIGN.md` generate/edit/parse/import/export;
- local screenshot/sketch/reference palette/layout analysis;
- local semantic draft generation without API credentials;
- optional hosted vision with strict structured output;
- bounded AI Edit proposal → preview → explicit Apply/Reject;
- declarative reusable AI skills;
- Anti-Slop v2 with hierarchy/spacing/typography/component/accessibility/cross-screen rules;
- local screenshot/pixel QA + optional two-image AI critique and bounded fix proposal.

### Interaction / prototype

- node-bound navigation flows + Play mode;
- structured hover/pressed/disabled/loading/error/success visual overrides;
- initial prototype state selection;
- hover/pressed interaction in Play mode.

### Review / history / collaboration

- durable page/node review threads;
- replies, resolve/reopen and approval status;
- automatic recovery checkpoints + restore UI;
- provider-neutral operation envelope and presence model;
- local BroadcastChannel realtime collaboration;
- remote HTTP/SSE collaboration mode;
- dedupe/out-of-order protection;
- reconnect snapshot bootstrap;
- self-host relay with optional persistence;
- signed project/room scoped viewer/editor/admin collaboration tokens.

### Optional cloud projects

Self-hostable cloud service (`npm run cloud:server`) provides:

- scrypt password hashing;
- expiring signed sessions;
- owner/editor/viewer project roles;
- optional user registration;
- cloud project list/open/save/delete;
- member management;
- optimistic revision conflicts instead of silent overwrite;
- activity records;
- local/export ownership preserved.

The cloud service is optional; the local project remains portable and usable without it.

### OpenPencil

- upstream-compatible MCP HTTP client and server identity/capability discovery;
- canonical PenNode push conversion;
- `set_design_md`, variable, component and screen upsert through official upstream tools;
- loss-aware pull from `list_pages`, `read_nodes`, `get_design_md`, variables and reusable nodes;
- pull preview before Apply;
- explicit loss reports rather than silent approximation.

Still required before OpenPencil integration can be called **Complete**: integration tests against a real running upstream instance across representative complex files and unsupported-feature round trips.

### Design ↔ code / repository context

- semantic React TSX + HTML generation;
- stable `data-page-id` / `data-node-id` instrumentation;
- semantic SVG export;
- DTCG-compatible token export;
- portable design↔code mappings;
- deterministic repository scanner (`npm run repo:scan`) for routes/components/CSS tokens/assets/hashes without uploading source contents;
- high-confidence mapping repair proposals;
- token drift hints;
- runtime DOM manifest capture and geometry/content/style/visibility QA;
- local screenshot pixel-diff changed regions + QA score;
- optional AI QA → bounded design operations;
- portable project bundle + SHA-256 project fingerprint.

### Agent/headless

- stateless tools for migrate/validate/apply operations/audit/codegen/OpenPencil conversion/summary;
- MCP-compatible HTTP endpoint;
- request size/rate/origin/token security guards;
- Codex/Claude/Gemini/Copilot repository entry instructions;
- DESIGN.md remains portable agent context.

### Extension ecosystem

Extension v1 is declarative-only by design:

- custom foundations;
- reusable AI skills;
- install/export/uninstall manifest;
- no arbitrary browser JavaScript execution.

## Quality/deployment discipline

GitHub Actions runs:

1. typecheck;
2. unit tests;
3. lint;
4. production Next.js build.

New feature batches are not considered accepted until this quality gate is green.

Vercel remains the web production target. Self-host cloud/collaboration processes are separate optional services and should not be forced into Vercel serverless.

## Important remaining gaps toward the full north-star

These are the main reasons this project is not marked Complete:

1. **OpenPencil real-runtime fidelity testing** across complex upstream documents.
2. **Component variants/component sets, nested override tools and richer ref reconciliation**.
3. **Deeper professional vector editing**: pen/Bezier, masks, boolean operations, rotation/effects and richer shapes.
4. **More canvas maturity**: smart guides/snapping visualization, reparenting UX, lock/visibility, rulers/grid controls and large-layer virtualization.
5. **Prototype maturity**: overlays/modals, flow variables, richer transitions and stateful multi-step scenarios.
6. **Existing app import**: authorized browser/runtime route capture and selective source-aware code→design updates.
7. **Automatic implementation screenshot capture** and fully headless CI visual regression/fix loop.
8. **Git branch/merge/conflict workflows** for portable project artifacts.
9. **Broader framework codegen/provider ecosystem**, local model integrations and provider cost routing.
10. **Packaged desktop/local mode**, deeper workers/indexing/render caches and very-large-project performance.
11. **More open-format interop** such as richer PDF/raster and feasible Figma pathways.
12. Optional cloud/collaboration services still need deployment to a user-selected backend workspace before they become hosted services.

## Next gates

Work in this order unless a concrete product need overrides it:

1. validate latest `main` with CI + Vercel READY;
2. perform live OpenPencil upstream round-trip test;
3. deploy optional cloud/collab services once a backend workspace is explicitly selected;
4. implement component variants/nested overrides + remaining canvas maturity;
5. add authorized existing-app capture/selective import;
6. automate browser screenshot capture + CI visual QA;
7. add Git branching/merge workflows and deeper performance work.

## Definition-of-progress rule

A UI button is not completion. Advance a capability only when its underlying data model, persistence, failure/recovery behavior, tests, interoperability and documentation justify the status.
