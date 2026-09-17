# Product Capability Specification — AI Design Canvas

This document defines the **target feature set and definition of done** for AI Design Canvas.

It is deliberately broader than the current MVP. Future agents should use it to avoid mistaking a partial implementation for the final product.

Status vocabulary:

- **Not started** — no meaningful implementation.
- **Foundation** — core types/interfaces or a narrow technical seam exists.
- **MVP** — usable end-to-end for a limited case.
- **Strong** — reliable for common real-world work.
- **Complete** — meets the definition of done here, including persistence, quality, errors, interoperability and documentation.

The status notes below describe the repository around the first working MVP and should be updated as implementation advances.

---

# 1. Workspace and project lifecycle

**Current: MVP**

The product must support projects as durable design/code contexts, not disposable chat generations.

## Required capabilities

- create, rename, duplicate, archive and delete projects;
- project metadata, description, target platforms and product context;
- multiple pages/screens per project;
- project assets and references;
- persistent `DESIGN.md`;
- structured design document;
- flow/prototype data;
- project settings and provider preferences;
- autosave;
- local export/import;
- optional cloud persistence;
- stable project/document IDs;
- schema versions and migrations;
- recovery from corrupted/partial saves;
- recent-project browser;
- templates / starter projects;
- offline/local-first path where practical.

## Complete when

A realistic project can be closed, reopened on another session/device via export/cloud sync, migrated across schema versions and edited without losing design contract, flows, mappings or assets.

---

# 2. Product understanding and planning

**Current: MVP deterministic planner**

AI Design Canvas should understand a product before drawing arbitrary screens.

## Inputs

- natural-language idea;
- product brief / PRD;
- feature list;
- existing app/code metadata;
- imported flow/site map;
- selected design references.

## Outputs

- product summary;
- personas/roles when relevant;
- information architecture;
- pages/routes;
- important states;
- entities/data objects;
- navigation model;
- core user journeys;
- screen requirements;
- reusable patterns/components;
- content hierarchy;
- unresolved questions/assumptions.

## Complete when

Generation is driven by an inspectable product plan, the plan can be edited independently of visual design, and regenerating/adding screens respects existing product structure rather than inventing incompatible routes or concepts.

---

# 3. Design foundations and style direction

**Current: MVP**

This subsystem provides the DPAI/OpenStitch-like art-direction layer.

## Required capabilities

- curated foundation library;
- style/treatment library;
- configurable density;
- radius language;
- typography direction;
- motion direction;
- theme/light-dark direction;
- accent/color family;
- platform-specific considerations;
- multiple references blended intentionally;
- custom user foundation;
- saved organization/project foundations;
- foundation metadata and provenance;
- preview before applying;
- semantic descriptions, not brand-asset copying;
- ability to derive a foundation from an existing website/app/reference;
- similarity/difference explanation when mixing references.

## Target library quality

The goal is not merely a large preset count. Foundations should encode useful design knowledge such as:

- information density;
- spacing rhythm;
- border/surface usage;
- typography hierarchy;
- component geometry;
- navigation conventions;
- motion character;
- interaction emphasis;
- chart/data presentation language;
- illustration/icon approach;
- do/don't rules.

## Complete when

A foundation changes project-wide generation/editing consistently, can be represented in `DESIGN.md` and variables, and new screens added later retain the same visual language.

---

# 4. `DESIGN.md` lifecycle

**Current: MVP**

`DESIGN.md` is a first-class portable contract for humans and arbitrary coding agents.

## Required capabilities

- create from style mixer/foundation;
- create from existing design document;
- create from existing website/app;
- import existing `DESIGN.md`;
- lint/validate;
- token/reference validation;
- readable frontmatter + prose;
- preserve prose while updating structured tokens;
- diff versions;
- merge non-conflicting edits;
- detect drift between `DESIGN.md` and document variables/components;
- one-click sync with explicit conflict handling;
- export;
- coding-agent friendly path/location;
- sections for typography, color, spacing, radius, surfaces, components, imagery, motion, interaction and accessibility;
- rationale/do/don't language;
- reference/foundation provenance;
- project-specific exceptions;
- schema versioning.

## Complete when

`DESIGN.md` can travel to a different coding agent/repository and still convey enough design direction for new implementation work to remain consistent, while synchronization back into the visual project is explicit and loss-aware.

---

# 5. Structured design document

**Current: Foundation/MVP**

The internal document should become rich enough to represent professional design intent.

## Required node/document concepts

- pages;
- frames/artboards;
- groups;
- rectangles/shapes;
- vectors/paths;
- text;
- images/media;
- icons;
- masks/clipping;
- fills/strokes;
- effects/shadows/blur;
- opacity/blend where supported;
- stable IDs;
- semantic roles;
- z-order;
- transforms;
- component references;
- variables/styles;
- layout constraints;
- interactions;
- comments/annotations;
- mapping metadata;
- export metadata.

## Engineering requirements

- JSON-serializable portable representation or reliable portable projection;
- explicit schema version;
- migrations;
- patch/operation model;
- deterministic serialization;
- validation;
- undo/redo compatible operations;
- large-document performance strategy.

## Complete when

The document can serve as a durable editable source for complex multi-page products and can be manipulated safely by both the GUI and agents without full-document regeneration.

---

# 6. Professional infinite canvas

**Current: MVP**

## Required capabilities

- pan/zoom;
- zoom-to-fit/selection;
- multi-page/frame spatial layout;
- frame selection;
- node selection;
- multi-select;
- drag/move;
- resize;
- rotate where appropriate;
- nesting/reparenting;
- layers panel;
- visibility/lock;
- alignment/distribution;
- snapping;
- smart guides;
- rulers/grid;
- keyboard shortcuts;
- copy/paste/duplicate;
- undo/redo;
- drag/drop assets;
- contextual controls;
- marquee selection;
- performant rendering at realistic scale;
- inspect mode;
- presentation/preview mode.

## Vector editing target

For a full OpenPencil-class editor path:

- pen/Bezier editing;
- points/handles;
- boolean operations;
- strokes/caps/joins;
- SVG import/export;
- masks;
- basic shape primitives.

## Complete when

A designer can meaningfully create and refine a product screen without needing AI regeneration for ordinary visual editing operations.

---

# 7. Auto-layout, constraints and responsive design

**Current: Not started/Foundation in geometry only**

## Required capabilities

- horizontal/vertical auto-layout;
- gap/padding;
- alignment;
- hug/fill/fixed sizing;
- min/max dimensions;
- wrapping/grid where useful;
- absolute children;
- responsive constraints;
- breakpoints/viewport variants;
- responsive preview;
- container behavior;
- adaptive typography/tokens;
- content-driven resizing;
- constraint-aware AI generation;
- responsive QA.

## Complete when

A screen is not just a 1440px snapshot: it can produce coherent mobile/tablet/desktop layouts from explicit constraints, and code export can preserve those relationships.

---

# 8. Components, instances, variants and design variables

**Current: Foundation target; tokens exist**

## Required capabilities

### Components

- create component from selection;
- reusable instances;
- nested components;
- instance overrides;
- detach instance;
- component properties;
- component sets/variants;
- swap instance;
- find all instances;
- rename/refactor safely;
- semantic component categories.

### Variables/tokens

- color;
- number/spacing;
- typography values;
- string where useful;
- boolean where useful;
- aliases/references;
- collections;
- modes/themes;
- light/dark;
- compact/comfortable density modes;
- semantic tokens versus raw primitives;
- token usage inspection;
- token migration/refactoring.

### Styles

- text styles;
- fill/stroke/effect styles where valuable;
- project-wide style replacement.

## Complete when

AI and humans can build reusable design systems instead of duplicating styles, and exported code maps reusable design structures to reusable code structures.

---

# 9. Asset and brand library

**Current: Minimal**

## Required capabilities

- image upload/import;
- SVG/icon import;
- project asset browser;
- brand logos/marks;
- color palettes;
- typography/font references;
- icon libraries;
- image generation/provider integration where configured;
- image crop/fit/fill;
- replace asset globally/locally;
- asset metadata and provenance;
- deduplication;
- missing-asset recovery;
- safe remote asset handling;
- optional cloud/CDN backing;
- export assets with project.

## Complete when

A real brand/product asset set can be managed without external ad-hoc file handling, and design/code mappings preserve asset identity.

---

# 10. Prompt → product / multi-screen generation

**Current: MVP deterministic path**

## Required capabilities

- generate entire initial product flow;
- generate one screen;
- generate a section/component;
- generate multiple alternative directions;
- generate from edited product plan;
- respect current components/tokens/`DESIGN.md`;
- preserve untouched screens during targeted work;
- structured semantic output;
- streaming/progress visibility;
- cancel/retry;
- provider fallback;
- deterministic/local fallback for basic flows where practical;
- cost/token visibility when using paid providers;
- prompt/history attached to generation events;
- explicit assumptions;
- generation diff before apply where useful.

## Complete when

Generated screens are coherent with the existing project, use reusable semantics, require refinement rather than reconstruction, and can be safely applied/undone.

---

# 11. Screenshot/reference → semantic design

**Current: Not started**

This should combine OpenStitch-like screenshot generation with a richer structured design target.

## Required capabilities

- upload screenshot(s);
- crop/reference region;
- infer hierarchy;
- infer layout regions;
- detect repeated components;
- infer typography scale;
- infer colors/tokens;
- detect images/icons;
- infer spacing/radius patterns;
- reconstruct semantic nodes;
- map to existing project components when possible;
- identify uncertainty;
- respect copyright/provenance boundaries;
- distinguish "replicate closely" from "use as direction";
- multiple references with weighting.

## Complete when

The result is an editable structured design with sensible layout/component semantics—not merely a screenshot placed on the canvas or one giant generated HTML blob.

---

# 12. Sketch/wireframe → structured design

**Current: Not started**

## Required capabilities

- image/photo/sketch input;
- rough box/text/button recognition;
- hierarchy inference;
- screen/section boundaries;
- convert wireframe intent to project components;
- apply selected design foundation;
- preserve layout intent while improving visual design;
- allow side-by-side sketch/reference comparison.

## Complete when

A low-fidelity sketch can become a coherent, editable, design-system-aware screen while maintaining the information architecture of the sketch.

---

# 13. Existing website/app → project import

**Current: Not started**

## Required capabilities

- capture rendered app/screens;
- discover routes/pages where authorized;
- inspect CSS/tokens/component patterns where accessible;
- infer `DESIGN.md`;
- infer design tokens;
- infer repeated component language;
- create editable screen representations;
- preserve source URL/reference metadata;
- optional browser extension/desktop capture;
- code-aware import for connected repositories.

## Complete when

A user can bootstrap AI Design Canvas from a real existing product rather than recreating the visual language manually.

---

# 14. User flows and prototyping

**Current: MVP**

## Required capabilities

- screen-to-screen flows;
- actions bound to nodes;
- click/tap;
- hover/focus where relevant;
- modal/overlay;
- back/close;
- navigation transitions;
- multiple flow starting points;
- variables/state for useful prototype scenarios;
- component interactive states;
- keyboard interaction where relevant;
- flow visualization;
- Play/presentation mode;
- shareable prototype;
- prototype → route/action mapping for code generation.

## Complete when

A meaningful product journey can be demonstrated and the interaction model can inform implementation instead of existing only as visual arrows.

---

# 15. AI editing and design skills

**Current: Foundation via deterministic operations**

## Required capabilities

- select element/section/page then instruct AI;
- targeted patch generation;
- generate variants;
- apply design-system cleanup;
- accessibility skill;
- responsive skill;
- content-density skill;
- typography skill;
- motion/interaction skill;
- componentization skill;
- layout alternatives;
- foundation extraction;
- existing-style matching;
- explain proposed changes;
- preview/diff before apply;
- undo;
- custom user/team skills;
- skill manifests/versioning.

## Multi-agent target

The system may parallelize independent design tasks, but an orchestrator must reconcile outputs against shared tokens/components and avoid inconsistent page islands.

## Complete when

Agents can modify small or large design scopes without destroying unrelated work and their operations are inspectable, reversible and consistent with project intent.

---

# 16. Anti-slop and design quality engine

**Current: MVP deterministic rules**

This is a core differentiator and must become substantially stronger.

## Deterministic checks

- excessive cards/containers;
- pill abuse;
- corner-radius inconsistency;
- spacing inconsistency;
- typography inconsistency;
- giant meaningless headings;
- tiny/inaccessible text;
- weak contrast;
- alignment errors;
- inconsistent controls;
- duplicate near-identical components;
- token bypasses;
- layout overflow;
- responsive breakage;
- excessive decorative gradients/glows;
- unclear button hierarchy.

## Semantic/visual checks

- weak information hierarchy;
- generic SaaS-template composition;
- meaningless fake metrics/content;
- insufficient differentiation between screens;
- inappropriate density;
- poor scanability;
- visual imbalance;
- deviation from reference/foundation;
- deviation from other project screens;
- content/design mismatch.

## Accessibility checks

- WCAG contrast where computable;
- text size/readability;
- focus states;
- target sizes;
- semantic/code export concerns;
- reduced-motion considerations;
- color-only status usage.

## Refinement

- targeted patch suggestions;
- severity/confidence;
- before/after preview;
- explain why;
- one-click safe fixes;
- batch fix;
- ignore/waive with rationale;
- project-specific rules.

## Complete when

Quality review is repeatable and materially improves designs without relying on full-screen regeneration or subjective one-line LLM prompts.

---

# 17. Review, comments and collaboration

**Current: Not started**

## Required capabilities

- comments anchored to page/node/coordinates;
- threaded replies;
- resolved/unresolved status;
- mention users;
- review links;
- screenshot/context snapshot at comment time;
- version comparison;
- presence/cursors;
- concurrent editing or conflict-aware sync;
- permissions/roles;
- project/team organization;
- design approvals/status;
- activity history.

## Complete when

A small product team can use the workspace for actual design review without relying on screenshots in another tool.

---

# 18. History, undo/redo and versioning

**Current: Partial via persisted document, no complete history model**

## Required capabilities

- operation-based undo/redo;
- autosave history;
- named checkpoints;
- compare versions;
- restore version;
- generation/refinement events in history;
- author metadata;
- document migration history;
- Git integration for portable artifacts;
- conflict resolution where relevant;
- optional design branches/experiments.

## Complete when

Users can safely explore, use AI and revert mistakes without fear that a generation destroys previous work.

---

# 19. Coding-agent integrations

**Current: Foundation via portable files/adapters**

## Target agents

- Codex;
- Claude Code;
- Gemini CLI;
- OpenCode;
- GitHub Copilot agent workflows where compatible;
- future MCP-capable agents.

## Required interfaces

- project summary;
- `DESIGN.md` access;
- screen/page query;
- component/token query;
- apply design operations;
- render request;
- run audit;
- flow query/update;
- code mapping query/update;
- screenshot/QA request;
- export/import;
- capability discovery.

## Delivery interfaces

- MCP;
- CLI;
- filesystem contracts;
- HTTP for remote/headless use;
- desktop/local bridge.

## Complete when

A fresh coding-agent session can understand the project and safely make design-aware implementation changes without relying on previous chat memory.

---

# 20. Design → production code

**Current: basic HTML export only**

## Target outputs

Prioritize quality over target count, but architecture should permit:

- React;
- Next.js;
- Vue;
- Svelte;
- HTML/CSS;
- React Native;
- Flutter;
- SwiftUI;
- Jetpack Compose;
- design-token exports.

## Required quality

- semantic HTML/controls where relevant;
- reusable components;
- project tokens/variables;
- responsive behavior;
- route/action mapping;
- accessibility baseline;
- asset reuse;
- clean file structure;
- deterministic mapping metadata;
- configurable framework conventions;
- diff/preview before integrating into existing repos.

## Complete when

Generated implementation is a maintainable starting point for production work and remains connected to design IDs/tokens instead of becoming untraceable throwaway code.

---

# 21. Production code → design/context round-trip

**Current: Not started**

This is one of the hardest and most important long-term capabilities.

## Required capabilities

- connect/import repository;
- discover routes/components;
- map implementation components to design components;
- map tokens/styles;
- run app and capture screenshots in authorized environments;
- detect implementation changes;
- update mappings;
- selectively import code-side changes into design/context;
- preserve hand-written production logic;
- avoid destructive overwrite;
- agent-assisted reconciliation when perfect automatic mapping is impossible.

## Complete when

Design and code can evolve over time without permanent one-way divergence.

---

# 22. Visual QA and design-vs-code verification

**Current: Not started**

## Required capabilities

- render design screenshot;
- capture implementation screenshot;
- same viewport/device matching;
- visual diff;
- geometry/layout classification;
- typography/color/token classification;
- content mismatch classification;
- responsive checks;
- flow/state checks where possible;
- tolerance configuration;
- issue list anchored to design/code;
- agent-generated targeted fix suggestions;
- CI/automation mode.

## Complete when

A coding agent or developer can ask "does production match the approved design?" and receive actionable, localized discrepancies instead of a vague visual judgment.

---

# 23. Import/export and interoperability

**Current: MVP JSON/HTML/`DESIGN.md`/bridge export**

## Required capabilities

- full project JSON/export archive;
- `DESIGN.md`;
- design token formats such as DTCG where useful;
- SVG;
- raster/PDF export;
- HTML/code exports;
- import exported projects;
- Figma interoperability where technically/legalistically practical;
- OpenPencil/native bridge;
- clipboard formats where useful;
- assets packaged/referenced safely;
- loss report when an external format cannot represent features.

## Complete when

Users retain ownership of their work and can move useful project/design data in and out without hidden lock-in.

---

# 24. Plugin, skill and foundation ecosystem

**Current: Not started**

## Required capabilities

- plugin manifest/API;
- custom design skills;
- custom foundation packs;
- custom exporters/importers;
- provider integrations;
- controlled project access/permissions;
- versioning;
- compatibility metadata;
- local/private plugins;
- optional public registry/discovery later.

## Complete when

Core development does not need to directly implement every framework, design methodology or provider integration.

---

# 25. AI providers and local models

**Current: provider abstraction foundation**

## Required capabilities

- provider-neutral interfaces;
- capability discovery: vision/text/tool use/context limits;
- model selection by task;
- local model option where practical;
- OpenAI/Anthropic/Gemini/open-router-style providers as integrations, not hard dependencies;
- secure key storage;
- server/local credential modes;
- cost/usage visibility;
- retry/fallback;
- streaming;
- structured output validation;
- prompt/version telemetry without leaking private content;
- explicit opt-in for external providers.

## Complete when

Switching providers does not change the project format, and core workflows degrade gracefully when a specific model/provider is unavailable.

---

# 26. Local, desktop, self-hosted and cloud modes

**Current: Vercel web MVP**

## Required modes

### Web/cloud

- zero-install workspace;
- sharing/review;
- optional cloud project sync.

### Self-hosted

- documented deployment;
- configurable storage/provider integrations;
- no hidden dependency on vendor cloud.

### Desktop/local

- local files/codebases;
- OpenPencil/native engine;
- secure local credentials;
- offline-friendly operation;
- heavier imports/rendering.

### Headless

- CLI/MCP/API-driven operation for agents/automation.

## Complete when

The same conceptual project can move between these modes without losing its design contract or structured document semantics.

---

# 27. Git and source-control integration

**Current: Git-friendly repository itself; project Git integration not started**

## Required capabilities

- export/sync portable project artifacts to Git;
- meaningful diffs for `DESIGN.md` and structured metadata;
- commit/checkpoint integration;
- branch awareness;
- merge/conflict UI for project metadata where feasible;
- generated-code diff;
- code mapping stored reviewably;
- avoid noisy nondeterministic serialization.

## Complete when

Design-system and implementation changes can participate in normal engineering review workflows instead of living in an opaque editor database.

---

# 28. Accessibility as a first-class capability

**Current: limited audit heuristics**

## Required capabilities

- contrast analysis;
- readable typography checks;
- focus/keyboard state modeling;
- interaction target sizing;
- accessible semantic code generation;
- reduced-motion support;
- screen-reader/name/role considerations in code mapping;
- accessibility issue reporting and safe fixes;
- design-system accessibility rules in `DESIGN.md`.

## Complete when

Accessibility is considered during generation, editing, audit and code output rather than added only after export.

---

# 29. Performance and large-project behavior

**Current: small MVP scale**

## Required capabilities

- canvas virtualization;
- incremental rendering;
- patch-based document updates;
- worker/off-thread processing;
- asset optimization;
- large project indexing/search;
- lazy loading pages/assets;
- render caches;
- bounded history storage;
- efficient collaboration ops;
- measurable performance budgets.

## Complete when

A realistic product with many pages/components/assets remains responsive and generation/refinement does not require loading/replacing the entire project.

---

# 30. Search, command palette and productivity UX

**Current: Not started**

## Required capabilities

- global command palette;
- search pages/nodes/components/tokens/assets;
- quick jump;
- recent commands;
- keyboard shortcut discoverability;
- contextual actions;
- inspect selection from agent/audit issue;
- batch selection/rename/refactor;
- reusable views/panels.

## Complete when

Experienced users can operate the system efficiently without navigating every feature through nested panels.

---

# 31. Content/data-aware design

**Current: generated demo content**

## Required capabilities

- content schemas/realistic datasets;
- table/list states;
- empty/loading/error/success states;
- localization stress testing;
- long/short content testing;
- generated realistic copy with explicit synthetic status;
- bind prototype data where useful;
- preserve content separately from visual style where practical.

## Complete when

Screens are evaluated against realistic product states rather than only idealized placeholder content.

---

# 32. States and interaction system

**Current: basic navigate action**

## Required capabilities

- default/hover/pressed/focus/disabled states;
- form validation states;
- loading/error/success;
- overlays/modals/popovers;
- component states;
- state transitions;
- transition/motion tokens;
- prototype state logic;
- code-generation mapping.

## Complete when

A design can express behavior beyond static screenshots and the implementation layer can understand those state intentions.

---

# 33. Observability, reliability and schema safety

**Current: basic tests/build pipeline**

## Required capabilities

- domain unit tests;
- serialization/migration tests;
- editor interaction tests;
- visual regression tests;
- import/export round-trip tests;
- provider contract tests;
- project recovery/backup strategy;
- error boundaries;
- operation logs for debugging;
- performance metrics;
- deployment health;
- privacy-aware telemetry only if explicitly implemented.

## Complete when

Schema/editor/provider changes can ship without routinely risking project corruption or silent quality regressions.

---

# End-state parity/superset requirement

The project should ultimately cover the useful workflow categories that motivated its creation:

## DPAI-like strengths to include

- curated design foundations;
- portable design context / `DESIGN.md`;
- strong anti-AI-slop refinement;
- design-focused project workflow;
- canvas/review context;
- coding-agent interoperability;
- templates/references/design-system guidance.

## OpenStitch-like strengths to include

- text → UI/product;
- screenshot → design;
- sketch → design;
- multi-screen generation;
- shared design system/context;
- screen flows;
- prototype/play mode;
- design skills;
- reference/foundation-driven generation.

## OpenPencil-like strengths to include

- professional structured/vector canvas;
- components/instances/variables/themes;
- auto-layout and responsive structure;
- agent/MCP/headless integration;
- anti-slop/refinement;
- collaboration/versioning direction;
- Git-friendly workflows;
- broad code/export targets;
- rich import/export and design-system tooling.

AI Design Canvas should **unify these categories instead of presenting them as separate applications**.

---

# Product-wide definition of done

A capability should not be labeled **Complete** unless, where applicable, it has:

1. a typed/domain representation;
2. persistent save/reload behavior;
3. UI and/or agent interface;
4. undo/recovery behavior for destructive changes;
5. explicit error states;
6. interoperability with `DESIGN.md` and/or structured document where relevant;
7. tests for core logic;
8. accessibility considerations;
9. documentation;
10. reasonable performance on realistic data;
11. import/export behavior or documented limitations;
12. no fake/stubbed primary action presented as functional.

The purpose of this specification is to prevent feature-count theater. The target is not to show many menu items; it is to build a coherent professional workflow.