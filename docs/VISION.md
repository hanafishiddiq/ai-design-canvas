# Product Vision — AI Design Canvas

## Why this project exists

AI-assisted UI creation is currently fragmented across several categories of tools:

- prompt-to-UI generators are fast but often produce generic design and weak project continuity;
- visual design tools are precise but usually lack deep agent-native workflows;
- coding agents can build real products but often do not retain a durable visual language;
- design-system tools capture tokens but not the full spatial/product context;
- one-way design-to-code systems drift as soon as production code changes.

AI Design Canvas exists to unify these strengths into one open-source workflow.

The project should allow a person or an AI agent to understand not only **what a screen looks like**, but also:

- why it looks that way;
- which design rules it follows;
- which reusable components it uses;
- how it behaves responsively;
- how screens connect into a product flow;
- how the design maps to production code;
- whether the implementation still matches the intended design.

## North-star statement

> Build an open-source AI-native design operating system where design intent, editable structured design, product flows and production code remain synchronized and accessible to both humans and coding agents.

The final product should combine four layers that are often separate today:

1. **Design intelligence** — art direction, foundations, `DESIGN.md`, skills, critique and project-wide visual memory.
2. **Professional structured editing** — real canvas, vector/shape/text editing, auto-layout, constraints, components, variables, themes and responsive variants.
3. **Product/prototype intelligence** — multi-screen generation, flows, interactions, states, review and collaboration.
4. **Implementation intelligence** — coding-agent context, code generation, code import, visual QA and design↔code round-trip.

## The user journey we are building toward

A user should eventually be able to start from any of these inputs:

- a plain-language product idea;
- a PRD/specification;
- screenshots or visual references;
- a hand-drawn sketch or wireframe;
- an existing website/app;
- a Figma/imported design;
- an existing codebase;
- an existing `DESIGN.md` or token set.

The system should then support this continuous workflow:

```text
INPUT
idea / PRD / screenshot / sketch / existing app / existing code
                         │
                         ▼
PRODUCT UNDERSTANDING
requirements · IA · entities · routes · states · user flows
                         │
                         ▼
DESIGN DIRECTION
foundation · references · tokens · typography · motion · DESIGN.md
                         │
                         ▼
STRUCTURED GENERATION
pages · frames · components · instances · content · responsive constraints
                         │
                         ▼
PROFESSIONAL CANVAS
select · draw · edit · auto-layout · variants · variables · assets
                         │
                         ▼
CRITIQUE / REFINEMENT
anti-slop · hierarchy · spacing · typography · accessibility · consistency
                         │
                         ▼
PROTOTYPE / REVIEW
flows · interactions · states · comments · versions · collaboration
                         │
                         ▼
IMPLEMENTATION
Codex / Claude Code / Gemini / OpenCode / other agents
                         │
                         ▼
PRODUCTION CODE
web / native / component libraries / design tokens
                         │
                         ▼
VISUAL QA + ROUND-TRIP
screenshots · diffs · semantic mapping · targeted fixes
                         │
                         └────────────── back to design/context
```

## What should make this project distinctive

### Portable design context

A project's design language should not live only inside one proprietary editor or chat history. `DESIGN.md` should make design intent portable across coding agents, repositories and environments.

It should contain both structured data and prose rationale: tokens alone are not enough, and prose alone is too ambiguous.

### Structured AI output

AI-generated design should not be treated as an image. It should create editable semantic objects with layout intent and reusable relationships.

A generated pricing card should be a component/instance candidate, not an accidental pile of unrelated rectangles. A responsive section should contain constraints, not just one fixed desktop snapshot.

### Design memory across the whole product

Adding a new screen months later should still preserve the project's established:

- typography hierarchy;
- spacing rhythm;
- component language;
- density;
- motion behavior;
- interaction conventions;
- visual personality.

### Anti-slop as engineering

High-quality design should not depend on repeatedly asking the model to "make it better".

The system should combine:

- deterministic rules;
- design heuristics;
- accessibility checks;
- component/token consistency checks;
- visual model critique;
- reference comparison;
- diversity tracking;
- targeted patches instead of destructive full regeneration.

### Human + agent co-editing

Humans should be able to directly manipulate the canvas while agents can operate on the same underlying structured document through MCP/CLI/API/filesystem contracts.

Neither side should be reduced to taking screenshots of the other's work.

### Design↔code continuity

Exporting code is not enough. The long-term target is continuity:

- components can map to code components;
- tokens map to code variables;
- routes map to implementation routes;
- flows map to behavior;
- production screenshots can be checked against design;
- code changes can inform the design context;
- agents can fix discrepancies without destroying unrelated work.

## Intended product modes

The mature product should support multiple deployment/use modes from one conceptual project format:

### Local / self-hosted

For privacy, offline work, private codebases and native/headless engines.

### Cloud web workspace

For zero-install access, sharing, collaboration, review and project synchronization.

### Desktop/native companion

For OpenPencil-class native rendering/editing, local filesystem/codebase integration and heavier agent workflows.

### Agent/headless mode

For Codex/Claude/Gemini/OpenCode and automation to manipulate projects without requiring a graphical session.

## Who it is for

Primary users:

- product designers who want AI without giving up structured editing;
- developers who want design-aware coding agents;
- solo builders who want one workflow from concept to code;
- design-engineering teams maintaining real design systems;
- AI agents that need a durable, explicit design contract.

The project should remain useful even when a user does not use a hosted AI provider.

## Quality bar for the mature product

The project is not "done" because a feature appears in the UI. Mature features should be:

- semantically correct;
- persistable and reloadable;
- undo/redo friendly;
- interoperable with the project model;
- accessible where applicable;
- testable;
- resilient to partial failures;
- performant on realistic projects;
- documented for humans and agents;
- compatible with schema migration/versioning;
- honest about unsupported cases.

## What this project should not become

Do **not** steer AI Design Canvas into any of these narrower identities:

- a generic AI landing-page generator;
- a chat wrapper that happens to preview HTML;
- an iframe gallery of generated pages;
- a static Figma clone with superficial AI;
- a one-way design-to-code exporter;
- a proprietary cloud format that cannot be exported;
- a thin skin over one model provider;
- a collection of visual presets without a real design model.

## Success condition

The long-term success condition is simple to state but demanding to implement:

> A user can move from product idea to coherent design system, professional editable multi-screen design, interactive prototype and production implementation while both humans and AI agents retain the same design intent and can continuously synchronize design and code.

`docs/PRODUCT_SPEC.md` turns this vision into concrete capability requirements.