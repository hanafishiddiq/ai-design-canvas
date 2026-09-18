# Target Architecture — AI Design Canvas

This document describes the **intended architecture**, not only the code that exists today.

The architecture is designed around one principle: humans, AI agents, the visual editor and production code should be able to work on the same product without reducing everything to screenshots or one-off HTML generation.

## Architectural layers

```text
┌────────────────────────────────────────────────────────────────────┐
│                         PRODUCT WORKSPACE                          │
│ projects · users · permissions · assets · history · comments      │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                    DESIGN INTELLIGENCE LAYER                      │
│ prompt/PRD understanding · foundations · references · DESIGN.md   │
│ screenshot/sketch ingestion · skills · critique · anti-slop       │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
                 ┌─────────────┴──────────────┐
                 ▼                            ▼
┌──────────────────────────────┐   ┌───────────────────────────────┐
│ PORTABLE DESIGN CONTRACT     │   │ STRUCTURED DESIGN DOCUMENT    │
│ DESIGN.md                    │   │ pages · nodes · components    │
│ tokens · intent · rationale  │   │ constraints · flows · assets │
└──────────────┬───────────────┘   └──────────────┬────────────────┘
               │                                   │
               │                     ┌─────────────▼──────────────┐
               │                     │ EDITOR / RENDERING ENGINE │
               │                     │ web canvas / OpenPencil   │
               │                     │ vector · layout · themes  │
               │                     └─────────────┬──────────────┘
               │                                   │
┌──────────────▼───────────────────────────────────▼───────────────┐
│                         AGENT INTERFACE                          │
│ MCP · CLI · filesystem contracts · HTTP · patches · snapshots   │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                       IMPLEMENTATION LAYER                       │
│ Codex · Claude Code · Gemini · OpenCode · code generators       │
│ React/Vue/Svelte/native targets · component libraries · routes  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                   VALIDATION / ROUND-TRIP LAYER                  │
│ screenshots · visual diff · semantic mapping · design QA        │
│ implementation inspection · targeted code/design reconciliation │
└──────────────────────────────────────────────────────────────────┘
```

## Canonical sources of truth

The system deliberately has multiple canonical artifacts for different kinds of truth.

### `DESIGN.md` — canonical design intent

Owns:

- visual philosophy;
- design rationale;
- typography direction;
- color/token intent;
- spacing/density language;
- component usage rules;
- motion/interaction guidance;
- do/don't rules;
- accessibility intent;
- reference/foundation metadata;
- machine-readable portable tokens where appropriate.

It should be readable by arbitrary coding agents without requiring the editor.

It does **not** own exact canvas geometry.

### Structured design document — canonical editable design state

Owns:

- pages and frames;
- node geometry;
- vector/text/image objects;
- layout groups and constraints;
- responsive variants;
- components, instances and overrides;
- variables, aliases and themes;
- prototypes/interactions;
- asset references;
- document-level metadata;
- stable IDs for semantic mapping.

This format should remain versioned, JSON-serializable/exportable and migration-safe even if OpenPencil becomes the underlying editor engine.

### Production code — canonical implementation state

Owns what actually executes in production.

The design document must not pretend it controls code it has not synchronized. Instead the product should maintain explicit mappings and run visual/semantic QA to detect drift.

### Mapping metadata — canonical relationship state

The mature project should keep mapping information such as:

- design component ID ↔ source component/file;
- design token ↔ CSS/design-token variable;
- page/frame ↔ application route;
- prototype action ↔ implementation behavior;
- design asset ↔ application asset.

Mappings should be inspectable and repairable rather than hidden in model memory.

---

## Core domain model target

The current `DesignProject` model is intentionally small. It should evolve toward a versioned model approximately covering:

```text
Project
├── metadata
├── designContractRef
├── variables
│   ├── collections
│   ├── aliases
│   └── modes/themes
├── textStyles
├── effects/styles
├── assets
├── components
│   ├── variants
│   └── properties
├── pages
│   └── nodes
│       ├── geometry
│       ├── paint/effects
│       ├── typography
│       ├── layout
│       ├── constraints
│       ├── responsive rules
│       ├── component/instance data
│       ├── semantic role
│       └── interaction bindings
├── flows
├── comments/review
├── mappings
│   ├── route mappings
│   ├── code mappings
│   └── asset mappings
└── history/version metadata
```

Every persisted schema needs an explicit version and migrations.

---

## Generation architecture

Generation should not directly jump from a prompt to arbitrary positioned nodes.

Target pipeline:

```text
Input
  │
  ▼
Product understanding
requirements · entities · IA · routes · states · flows
  │
  ▼
Design direction resolution
references · foundation · DESIGN.md · token/theme proposal
  │
  ▼
Semantic screen plan
sections · components · content hierarchy · actions
  │
  ▼
Layout synthesis
responsive constraints · components · auto-layout · geometry
  │
  ▼
Structured design document patches
  │
  ▼
Render
  │
  ▼
Critique / anti-slop / accessibility / consistency
  │
  ▼
Targeted patches
```

Each stage should be inspectable and replaceable. Provider-specific LLM calls must sit behind interfaces.

## Screenshot / sketch ingestion

The desired output of screenshot/sketch ingestion is **semantic reconstruction**, not only HTML recreation.

A reconstruction pipeline should attempt to identify:

- layout regions;
- repeated components;
- spacing rhythm;
- typography hierarchy;
- tokens/colors;
- likely responsive relationships;
- assets/icons;
- interaction hints;
- reusable patterns.

Confidence/uncertainty should be surfaced where reconstruction is ambiguous.

## Editor engine boundary

The project should support two editor paths without forking the product model.

### Web-native editor

Useful for:

- Vercel/cloud access;
- light editing;
- review;
- collaboration;
- portable project access.

### OpenPencil-class native/headless editor

Useful for:

- richer vector editing;
- high-performance rendering;
- professional layout/component operations;
- local files;
- heavier import/export;
- agent-driven headless operations.

Use `OpenPencilAdapter`/successor interfaces for synchronization. The Vercel app must not require a native daemon to boot.

The adapter should eventually support capabilities such as:

```ts
interface DesignEngineAdapter {
  capabilities(): Promise<EngineCapabilities>;
  open(project: ProjectSnapshot): Promise<EngineSession>;
  readDocument(): Promise<StructuredDocument>;
  applyOperations(operations: DesignOperation[]): Promise<OperationResult>;
  render(request: RenderRequest): Promise<RenderArtifact>;
  importArtifact(input: ImportRequest): Promise<ImportResult>;
  exportArtifact(input: ExportRequest): Promise<ExportResult>;
  close(): Promise<void>;
}
```

Avoid baking OpenPencil-specific implementation details into every UI/domain type.

---

## Agent architecture

Coding/design agents should work through explicit capabilities rather than uncontrolled full-state regeneration.

Target interfaces:

- read project summary;
- read/write `DESIGN.md`;
- query pages/nodes/components/tokens;
- apply typed patches/operations;
- render screenshots;
- run audits;
- inspect flows;
- generate variants;
- inspect code mappings;
- request visual QA;
- update mapping state.

The mature system should expose these over MCP and optionally CLI/HTTP.

### Preferred operation model

Prefer operations such as:

```text
set_text(node, value)
set_variable(alias, value)
set_padding(node, value)
create_component(...)
instantiate_component(...)
set_auto_layout(...)
connect_flow(...)
replace_asset(...)
```

over destructive "regenerate the whole page" operations.

Full regeneration remains useful for early exploration but should not be the default editing primitive.

---

## Anti-slop / critique architecture

Quality evaluation should have several independent layers:

### Deterministic structural checks

Examples:

- inconsistent spacing;
- excessive corner radii/pills;
- too many container cards;
- broken alignments;
- unsupported tiny text;
- inaccessible contrast approximations;
- excessive heading scale;
- inconsistent component treatment;
- token bypasses;
- duplicated near-identical components.

### Semantic heuristics

Examples:

- weak hierarchy;
- content density mismatch;
- redundant controls;
- unclear primary action;
- fake/meaningless dashboard metrics;
- accidental visual repetition.

### Visual critique

Rendered screenshot/model review for issues not visible in the tree alone.

### Reference/design-contract comparison

Check divergence from `DESIGN.md`, selected references, foundation and existing product screens.

### Refinement

Produce targeted, explainable operations with preview/undo—not opaque full-page replacements.

---

## Code generation and synchronization

A future code pipeline should be target-adapter based:

```text
Structured design + DESIGN.md + mappings
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
      React    Vue     Native/etc.
```

Code generation must preserve:

- semantic component boundaries;
- token variables;
- responsive rules;
- accessibility semantics;
- route/action mappings;
- stable design↔code mapping IDs where practical.

For existing codebases, prefer an agent-assisted mapping process rather than destructive code replacement.

## Visual QA loop

Target loop:

```text
Design render ─┐
               ├─ compare → classify differences → targeted fix
App screenshot ┘
```

Differences should distinguish:

- intended product implementation differences;
- layout bugs;
- typography/token mismatch;
- content mismatch;
- responsive mismatch;
- missing states/interactions.

Visual QA should be runnable by humans and agents.

---

## Persistence and collaboration

MVP may use local storage, but the mature architecture needs:

- versioned project snapshots;
- operation/event history;
- undo/redo;
- conflict-aware collaboration;
- comments/annotations anchored to stable nodes/frames;
- review snapshots/screenshots;
- branching/version comparison where useful;
- project export without the cloud service.

A collaboration backend must not become the only place where the project can be understood.

## Git strategy

Git-friendly files are a feature.

Where practical:

- `DESIGN.md` is normal text;
- project metadata is structured text/JSON;
- generated exports are reproducible;
- schema versions are explicit;
- binary assets use stable references;
- meaningful changes can be reviewed.

Native editor formats may coexist with canonical portable exports/adapters.

## Deployment topology

Recommended mature topology:

```text
Vercel / cloud web app
├── workspace UI
├── project API
├── collaboration/review
└── lightweight AI orchestration

Optional design-engine service
├── OpenPencil/headless/native runtime
├── render/import/export
└── heavy structured editing operations

Optional local desktop companion
├── filesystem/codebase access
├── native editor
├── local models/providers
└── secure credentials

Coding agents
└── MCP / CLI / filesystem / API contracts
```

No single optional service should make project files permanently inaccessible.

## Security boundaries

- never commit provider secrets;
- prefer server-side or OS credential storage for secrets;
- distinguish untrusted imported content from system instructions;
- sanitize generated HTML/preview execution;
- sandbox code previews;
- scope agent capabilities where destructive operations are possible;
- keep project exports free of accidental secrets.

## Performance target

The architecture should eventually handle realistic multi-page product files, not only four demo frames.

Plan for:

- virtualized canvas rendering;
- incremental document updates;
- patch-based sync;
- asset caching;
- worker/off-main-thread heavy computation where useful;
- large-document indexing;
- render caching;
- streamed agent operations.

## Architectural rule of thumb

When adding a feature, ask:

> Is this feature becoming part of the durable project model and agent interface, or is it only a UI trick?

For core capabilities, prefer the former.

---

# Implemented runtime/service boundaries (current checkpoint)

The following boundaries now exist in code:

- **Web/Vercel:** Studio, references, review, AI proposals, repository manifests, pixel QA, extensions and export UX.
- **Local document store:** schema migration, validation, checkpoints, BroadcastChannel sync and portable bundles.
- **Collaboration relay:** self-host Node HTTP/SSE process with snapshot persistence and scoped signed roles.
- **Optional cloud project service:** self-host Node process with users, scrypt credentials, expiring sessions, project roles and optimistic revisions.
- **OpenPencil boundary:** MCP HTTP client with capability discovery, official push tools and loss-aware pull reconciliation.
- **Agent/headless boundary:** stateless MCP-compatible HTTP tools; project state stays caller-supplied.
- **Repository boundary:** static metadata manifest (routes/components/tokens/assets/hashes) rather than mandatory raw-source upload.
- **Visual QA boundary:** DOM runtime manifests plus local pixel comparison; hosted image critique remains explicit/optional.

These services are intentionally separate. Do not merge native/headless/cloud infrastructure into Vercel simply to make deployment topology look simpler.
