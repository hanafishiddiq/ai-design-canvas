# AGENTS.md — AI Design Canvas operating guide

This file is the **first document every coding/design agent should read before changing this repository**.

AI Design Canvas is not intended to remain a small prompt-to-UI demo. The long-term goal is to build a serious, open-source **AI-native product design and implementation environment** that combines the strongest ideas of OpenStitch-style design intelligence, OpenPencil-style structured editing, DPAI-style portable design direction, and modern coding agents.

## Read these documents in order

1. `AGENTS.md` — working rules and non-negotiable product intent.
2. `docs/VISION.md` — why the product exists and what the final product should become.
3. `docs/PRODUCT_SPEC.md` — exhaustive target capabilities and definition of done.
4. `docs/ARCHITECTURE.md` — target architecture, source-of-truth rules, adapters and deployment boundaries.
5. `docs/ROADMAP.md` — staged path from the current MVP to the target product.
6. `README.md` — current implementation, setup and existing modules.

When documentation and a local implementation differ, **do not silently redefine the product around the current implementation**. Treat the current implementation as an incomplete step toward the documented target. Update the docs only when product intent genuinely changes.

---

## North-star product

The end state should feel like one coherent product that can take a user from:

**idea / prompt / screenshot / sketch / existing app / design reference**

→ product structure and user flows

→ curated art direction and portable `DESIGN.md`

→ editable multi-screen design on a professional canvas

→ components, variables, themes and responsive constraints

→ AI critique and anti-slop refinement

→ interactive prototype and collaboration/review

→ production code generated or edited by coding agents

→ visual QA against the design

→ iterative round-trip between design and code without losing intent.

The product should eventually cover or exceed the useful design-oriented capabilities of **DPAI, OpenStitch and OpenPencil as a unified workflow**, while remaining open-source and agent-friendly.

---

## Core product principles

### 1. Design intent and design state are different sources of truth

Keep both:

- `DESIGN.md` = portable, human/agent-readable design intent, tokens, rationale, rules and visual direction.
- Structured design document = precise editable spatial state: pages, nodes, components, instances, variables, constraints, flows and geometry.

Never collapse one into the other.

### 2. The canvas must become genuinely editable

Do not settle for an iframe gallery or screenshots pretending to be a design tool. The target is structured editing with selectable elements, geometry, layout constraints, components, instances, variables, themes, vector primitives and responsive behavior.

### 3. AI generation must produce structured semantics, not only pixels or HTML

Prompt/screenshot/sketch generation should increasingly create meaningful objects such as frames, components, auto-layout groups, tokens, text styles, actions and reusable patterns. HTML may be an export target, not the only canonical representation.

### 4. AI should preserve and improve a product's design language

The system should remember project-wide design direction, components, interaction rules, content density and visual rationale. Every new screen should look like it belongs to the same product.

### 5. Avoid generic "AI slop"

Anti-slop is a first-class subsystem, not a one-line prompt. It should include deterministic rules, visual/semantic critique, diversity tracking, accessibility checks, hierarchy/spacing/typography evaluation, component consistency and targeted refinement patches.

### 6. Design and production code must eventually round-trip

The product is not complete if designs only export once and drift forever. Target bidirectional workflows:

- design → implementation
- code/app → imported semantic representation
- visual regression/QA
- agent fixes that respect `DESIGN.md`

### 7. Coding agents are collaborators, not a hidden monolith

Maintain open interfaces for Codex, Claude Code, Gemini CLI, OpenCode and future agents through filesystem contracts, MCP, CLI/HTTP adapters and explicit project context.

### 8. OpenPencil integration is a boundary, not a Vercel dependency

Do not force native/Rust/CanvasKit/headless infrastructure into Vercel serverless. The web product should remain deployable independently while local/remote OpenPencil-class engines can become authoritative editors/renderers through adapters.

### 9. Primary features must be real

Do not add buttons that simulate completion, fake AI results, fake collaboration, fake sync, or success states without performing the underlying operation. A smaller working feature is preferred over a visually complete fake feature.

### 10. Preserve openness and portability

Projects should remain exportable. Do not lock core project state into a proprietary backend-only format. Prefer JSON/text contracts, documented schemas, standard assets and Git-friendly state where feasible.

---

## Non-negotiable long-term capability areas

Agents should assume the final product needs all of these areas to become strong, not merely present:

1. Project/workspace and versioned design documents.
2. Prompt → multi-screen/product generation.
3. Screenshot/reference → semantic design reconstruction.
4. Sketch/wireframe → semantic design reconstruction.
5. Existing website/app → design-system and screen import.
6. Curated design foundations and style mixing.
7. Rich `DESIGN.md` lifecycle and synchronization.
8. Professional infinite canvas and vector editing.
9. Auto-layout, constraints and responsive variants.
10. Components, instances, variants, variables, tokens and themes.
11. Assets, icons, typography and brand-library management.
12. User flows and interactive prototyping.
13. AI design skills, multi-agent generation and targeted editing.
14. Anti-slop, visual critique, accessibility and design QA.
15. Comments, annotations, review history and collaboration.
16. Git/versioning and merge-aware project state.
17. Coding-agent integrations and MCP/CLI interfaces.
18. Design → production code generation across useful targets.
19. Production code → design/context import and round-trip updates.
20. Screenshot-based visual regression and design-vs-code QA.
21. Plugin/extension system and custom skills/foundations.
22. Self-hosting/local-first operation plus optional cloud sync.
23. Secure provider/key management and pluggable AI providers.
24. Import/export with open formats; Figma interoperability where legally/technically practical.
25. Robust testing, migrations, schema versioning and observability.

The detailed definition of done is in `docs/PRODUCT_SPEC.md`.

---

## Current baseline

The repository currently has a functioning web MVP with:

- deterministic prompt → multi-screen generation;
- foundation/style mixer;
- portable `DESIGN.md` generation/edit/import/export;
- typed structured design model;
- interactive multi-screen canvas with pan/zoom/basic dragging;
- property inspector;
- prototype flows/play mode;
- deterministic anti-slop audit + safe refinement;
- local persistence;
- JSON/HTML/OpenPencil-bridge exports;
- OpenPencil local/HTTP adapter boundary;
- Vercel deployment.

This is a **foundation, not the end state**.

---

## Engineering rules for future agents

Before implementing a substantial change:

- identify which target capability it advances;
- preserve `DESIGN.md` ↔ structured-model separation;
- prefer typed domain models and explicit adapters over UI-only state;
- add migrations when persisted schemas change;
- keep the app functional without mandatory proprietary AI credentials whenever a deterministic/local fallback is reasonable;
- add tests for domain logic;
- run lint, typecheck, tests and production build when feasible;
- update relevant docs when architecture or capability status changes;
- do not claim a roadmap item is complete until its definition of done is actually met.

For feature status, use these meanings:

- **Not started** — no meaningful implementation.
- **Foundation** — architecture/data model exists, UX not complete.
- **MVP** — usable end-to-end for a narrow case.
- **Strong** — handles common real-world cases reliably.
- **Complete** — meets the definition of done in `docs/PRODUCT_SPEC.md`, including quality, persistence, error handling and integration.

---

## Product decision heuristic

When several implementation options are possible, prefer the one that moves the repository toward this identity:

> **An open-source AI-native design operating system where design intent, editable structured design, product flows and production code remain synchronized and accessible to both humans and coding agents.**

Do not optimize the repository into a generic landing-page generator, a thin chat wrapper, a static mockup gallery, or a one-way code generator.
