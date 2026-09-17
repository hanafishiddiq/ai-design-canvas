# Roadmap — AI Design Canvas

This roadmap is ordered by **dependency and product leverage**, not by calendar date. Do not attach artificial dates unless maintainers explicitly choose them.

The current web MVP proves the core concept. The next work should deepen the structured design system before adding large numbers of surface-level integrations.

## Phase 0 — Working foundation

**Status: substantially complete for MVP**

Established:

- Next.js/Vercel web workspace;
- typed project/page/node/flow model;
- deterministic prompt → multi-screen planner;
- curated foundation/style mixer;
- `DESIGN.md` generate/edit/parse/export;
- multi-screen canvas with pan/zoom/basic dragging;
- inspector;
- prototype navigation/play mode;
- deterministic anti-slop audit/refine;
- local persistence abstraction;
- JSON/HTML/OpenPencil bridge exports;
- OpenPencil adapter boundary;
- tests, typecheck and production build baseline;
- persistent vision/product/architecture documentation.

Phase 0 is not the final product. It is the proof that the layers can coexist.

---

# Phase 1 — Professional structured design core

**Highest priority.** Most later features depend on this.

## 1A. Document operations and history

- introduce explicit schema version/migrations;
- typed operation/patch model;
- undo/redo;
- autosave checkpoints;
- deterministic serialization;
- validation and recovery;
- selection/multi-selection state separated from document state.

### Gate

Agent and UI edits can be applied as reversible operations instead of replacing entire pages/projects.

## 1B. Layout model

- frame/group nesting;
- horizontal/vertical auto-layout;
- padding/gap/alignment;
- hug/fill/fixed sizing;
- min/max sizing;
- responsive constraints;
- breakpoint/viewport representation;
- layout engine tests.

### Gate

A generated screen can adapt to at least desktop/mobile widths from explicit layout semantics.

## 1C. Components and variables

- components;
- instances;
- instance overrides;
- variants/component sets;
- variable collections;
- aliases;
- theme/mode support;
- text/style primitives;
- usage/refactoring tools.

### Gate

A repeated UI pattern can exist as one component with multiple instances and survive save/export/regeneration.

## 1D. Canvas editing maturity

- multi-select/marquee;
- resize;
- nesting/reparenting;
- layers panel;
- snap/guides;
- alignment/distribution;
- copy/paste/duplicate;
- keyboard shortcuts;
- undo/redo UI;
- contextual toolbar;
- viewport performance improvements.

### Gate

Ordinary visual edits do not require AI regeneration.

---

# Phase 2 — Real design-engine / OpenPencil integration

The product model must remain independent from any one engine while gaining OpenPencil-class power.

## Work

- capability-aware `DesignEngineAdapter` successor;
- headless/local OpenPencil service proof of concept;
- document conversion bridge;
- patch synchronization;
- render/screenshot requests;
- import/export requests;
- engine health/capability discovery;
- graceful web-only fallback;
- local desktop bridge option;
- conflict/error handling.

## Gate

The same project can be opened/edited through the web model and a real OpenPencil/headless engine without silently losing core semantics.

---

# Phase 3 — Multimodal design ingestion

## 3A. Screenshot/reference → semantic design

- image/reference upload;
- vision provider interface;
- region/layout inference;
- text hierarchy detection;
- spacing/color/radius extraction;
- repeated-component detection;
- semantic structured output;
- reference-versus-replication modes;
- uncertainty/confidence UI.

## 3B. Sketch/wireframe → design

- rough region/control detection;
- information hierarchy preservation;
- foundation/style application;
- semantic component synthesis.

## 3C. Existing app/site import

- authorized browser/capture workflow;
- route/screen capture;
- design-token/style inference;
- foundation and `DESIGN.md` extraction;
- repeated-component inference;
- optional code-aware import.

## Gate

At least screenshot and sketch inputs produce editable structured screens rather than flat images/HTML-only artifacts.

---

# Phase 4 — Advanced AI design intelligence

## 4A. Provider system

- provider-neutral task interfaces;
- vision/text/tool capability discovery;
- task-specific model routing;
- local/hosted provider support;
- retries/fallbacks;
- structured-output validation;
- usage/cost visibility;
- secure credential storage patterns.

## 4B. Agent editing

- selection-scoped instructions;
- typed operation generation;
- proposed diff/preview;
- apply/reject;
- alternatives;
- componentization skill;
- responsive skill;
- typography/layout skill;
- accessibility skill;
- foundation extraction;
- custom skills.

## 4C. Anti-slop v2

- stronger deterministic rules;
- visual screenshot critique;
- semantic hierarchy critique;
- diversity/repetition tracking;
- `DESIGN.md` adherence;
- cross-screen consistency;
- accessibility checks;
- targeted auto-fix with before/after preview;
- rule waivers/project-specific configuration.

## Gate

AI can improve a selected region or full flow through localized, reversible operations that preserve components/tokens and untouched work.

---

# Phase 5 — Product flows, review and collaboration

## Prototype maturity

- overlays/modals;
- component states;
- hover/focus/pressed/disabled;
- loading/error/success states;
- flow variables/state;
- transitions;
- multiple prototype entry points;
- shareable presentation mode.

## Review

- node/coordinate anchored comments;
- threaded discussion;
- screenshots/context snapshots;
- resolve/reopen;
- design approval/status;
- version comparison.

## Collaboration/cloud

- authenticated users/projects;
- permissions;
- cloud persistence;
- operation sync;
- presence/cursors;
- conflict strategy;
- local/export ownership preserved.

## Gate

A small team can design, review and prototype a product inside AI Design Canvas without relying on screenshot-based external review for normal workflows.

---

# Phase 6 — Coding-agent and production-code integration

## Agent interface

Expose mature project operations via:

- MCP;
- CLI;
- filesystem/project context;
- HTTP/headless API.

Support Codex, Claude Code, Gemini CLI, OpenCode and future compatible agents without embedding agent-specific logic in the project model.

## Design → code

Start with highest-value targets (likely React/Next.js + HTML/CSS), then expand through adapters.

Requirements:

- component reuse;
- tokens;
- responsive layout;
- accessibility semantics;
- route/flow mapping;
- assets;
- stable mapping metadata;
- diff before integration into existing repositories.

## Gate

A coding agent can start from a fresh session, read the project contract, generate/edit production code and preserve explicit design mappings.

---

# Phase 7 — Design↔code round-trip and visual QA

This phase turns the product from an exporter into a continuous design-engineering environment.

## Code → design/context

- repository connection;
- route/component discovery;
- token/component mapping;
- app runtime capture;
- selective import/update;
- mapping repair;
- preserve hand-written logic.

## Visual QA

- matched design/app screenshots;
- viewport/state selection;
- visual diff;
- layout/typography/color/content classification;
- issue anchors;
- tolerance configuration;
- targeted agent fix;
- CI/headless mode.

## Gate

A team can detect and repair design/implementation drift without manually comparing screenshots and rewriting pages.

---

# Phase 8 — Interoperability, ecosystem and platform maturity

## Import/export

- full portable project archive;
- SVG/raster/PDF;
- DTCG/design-token formats;
- robust OpenPencil interop;
- Figma interoperability where feasible;
- loss reports for unsupported features.

## Git

- reviewable project artifacts;
- project/version checkpoints;
- branch awareness;
- merge/conflict workflows;
- generated code mappings.

## Plugin ecosystem

- plugin manifest/API;
- custom skills;
- custom foundations;
- import/export plugins;
- provider plugins;
- local/private plugins;
- permissions/versioning.

## Platform modes

- cloud web;
- self-hosted;
- desktop/local;
- headless/agent mode;
- same conceptual project across modes.

## Performance

- virtualized large canvas;
- incremental rendering;
- workers;
- asset caches;
- large-project search/indexing;
- render caching;
- performance budgets.

## Gate

The platform is extensible and comfortable for real multi-page production projects, not only demos.

---

# Cross-cutting work that should happen continuously

These are not postponed to a final cleanup phase:

- accessibility;
- security/sandboxing;
- schema migrations;
- tests;
- import/export round-trip tests;
- error recovery;
- performance measurement;
- documentation;
- licensing/provenance;
- project portability;
- agent-friendly context.

---

# Recommended immediate next tasks

Unless a concrete user need overrides sequencing, the next substantial engineering work should prioritize:

1. **operation model + undo/redo + schema migrations**;
2. **auto-layout/constraints**;
3. **components/instances/variables/themes**;
4. **canvas resize/multi-select/layers/snapping**;
5. **stronger `DESIGN.md` ↔ variables sync**;
6. **real OpenPencil/headless adapter proof of concept**;
7. **screenshot → semantic design pipeline**;
8. **agent/MCP operations on the structured document**.

Why this order: screenshot AI, multi-agent generation and code round-trip become far more valuable once the design document can represent reusable components, responsive layout and reversible edits.

---

# Roadmap discipline for agents

When completing work:

- update status in `docs/PRODUCT_SPEC.md` only if the capability genuinely moved stages;
- update this roadmap if dependencies or sequencing materially change;
- do not mark a whole phase complete because one demo path works;
- prioritize semantic/project-model depth over adding many disconnected UI buttons;
- maintain the north-star described in `docs/VISION.md`.