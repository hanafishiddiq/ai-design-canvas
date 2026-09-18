# AI Design Canvas

> **North star & agent context:** This README describes the implementation. Before substantial product/architecture work, read [`AGENTS.md`](./AGENTS.md), [`docs/VISION.md`](./docs/VISION.md), [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), and [`docs/ROADMAP.md`](./docs/ROADMAP.md). Those documents define the long-term product; the current MVP is only one stage toward it.

AI Design Canvas is an open-source, design-first product workbench that combines the strongest ideas from **OpenStitch-style design intelligence** with an **OpenPencil-ready structured canvas model**.

The current web editor is intentionally Vercel-friendly: core design workflows work without an AI API key or native daemon, while adapter boundaries let a local/remote OpenPencil MCP engine and optional hosted vision provider add deeper capabilities without becoming hard dependencies.

## What already works

- Prompt → coherent multi-screen product plan with deterministic local generation.
- Curated style foundations, style mixer and declarative custom foundation extensions.
- First-class `DESIGN.md` generation/edit/import/export with portable intent separate from geometry.
- Versioned schema-v5 design document with migrations, validation, deterministic serialization and recovery checkpoints.
- Operation-backed undo/redo and batch edits.
- Structured Studio canvas: pan/zoom, page culling, marquee, drag/resize, multi-select, align/distribute, design clipboard, layers and command search.
- Auto-layout, fixed/hug/fill sizing, responsive constraints and mobile/tablet/desktop preview.
- Components/instances/override metadata, variable collections/themes and interaction visual states.
- Prototype navigation and Play mode with hover/pressed/disabled/loading/error/success presentation states.
- Anti-Slop v2 + accessibility/cross-screen checks + safe refinement.
- Screenshot/sketch/reference library, local visual analysis and no-key semantic draft generation.
- Optional hosted vision using strict Structured Outputs, invoked only explicitly.
- Bounded AI Edit proposal → preview → Apply/Reject and declarative reusable AI skills.
- Review threads/status, local realtime collaboration and remote HTTP/SSE collaboration with reconnect snapshot recovery.
- Signed scoped collaboration roles plus optional authenticated self-host cloud projects.
- OpenPencil MCP capability discovery, official push tools, and loss-aware bidirectional pull preview.
- Semantic React TSX, HTML and SVG export plus DTCG-compatible design-token export.
- Stable design↔code IDs/mappings, repository metadata scanner, mapping repair and token drift hints.
- Runtime manifest QA + local screenshot pixel diff + optional two-image AI critique and bounded fix proposal.
- Portable `.adc.json` project bundles with SHA-256 fingerprints.
- Stateless MCP/headless project tools for coding agents.
- Declarative extension ecosystem for foundations and AI skills.
- Security request guards/rate limits, accessibility focus/reduced-motion baseline, GitHub Actions CI and Vercel deployment.

See `STATUS.md` for the freshest implementation checkpoint and remaining gaps.

## Architecture

```text
Prompt / DESIGN.md / image references
                  │
                  ▼
        Design intelligence layer
 foundations · vision · planner · anti-slop
                  │
                  ▼
         Portable design contract
               DESIGN.md
                  │
                  ├────────────────────┐
                  ▼                    ▼
       Structured design model   Agent context
 pages · nodes · variables       Codex/Claude/etc.
 components · constraints
                  │
                  ▼
       Operation-backed Studio
 undo · layout · components · flows
                  │
          ┌───────┴────────┐
          ▼                ▼
     Local web core   OpenPencil MCP
                      headless / desktop
          │                │
          └───────┬────────┘
                  ▼
     JSON / HTML / React / codegen
```

The key architectural decision is that **`DESIGN.md`, structured design state, and production code are separate but explicitly mappable sources of truth**:

- `DESIGN.md` is the portable design intent and machine-readable token contract arbitrary coding agents can understand.
- The structured document is precise editable spatial/semantic state used by the canvas and design engines.
- Production code remains real code, not a hidden serialization format for the canvas.

## Core modules

| Module | Responsibility |
| --- | --- |
| `src/lib/types.ts` | Versioned structured design document model |
| `src/lib/schema.ts` | Schema validation + migrations |
| `src/lib/operations.ts` | Reversible typed operations + undo/redo |
| `src/lib/layout.ts` | Auto-layout computation |
| `src/lib/responsive.ts` | Responsive constraint projection |
| `src/lib/components.ts` | Components/instances primitives |
| `src/lib/variables.ts` | Variable collections + modes |
| `src/lib/foundations.ts` | Foundation presets, style mixing and token generation |
| `src/lib/design-md.ts` | `DESIGN.md` serialize/parse/merge bridge |
| `src/lib/planner.ts` | Local deterministic prompt → multi-screen planner |
| `src/lib/reference-analysis.ts` | Local image analysis/compression/palette extraction |
| `src/lib/vision.ts` | Semantic hosted-vision schema and design conversion |
| `src/lib/anti-slop.ts` | Audit rules and safe refinement patches |
| `src/lib/openpencil-mcp.ts` | Native OpenPencil MCP JSON-RPC connector |
| `src/lib/openpencil-convert.ts` | Structured model → OpenPencil PenNode conversion |
| `src/lib/storage.ts` | Persistence/checkpoint abstraction |
| `src/lib/export.ts` | Semantic project/screen code export |
| `src/components/studio-workspace.tsx` | Operation-backed professional canvas/editor |

## DESIGN.md contract

AI Design Canvas stores structured values in YAML frontmatter and preserves the prose body independently:

```md
---
schema: ai-design-canvas/v1
project: Signal Workspace
direction:
  foundation: linear
  treatment: precision
  density: compact
tokens:
  colors:
    background: "#0b0c0f"
    accent: "#7c8cff"
---

# Art direction

Keep the product dense, quiet and tool-like.
```

Editing prose does not destroy token structure, and regenerating token frontmatter preserves the prose body.

## OpenPencil integration

Run current OpenPencil locally/headless with a backing `.op` file:

```bash
op start --headless --file design.op
```

OpenPencil exposes MCP HTTP on port 3100 by default. Open **OpenPencil** in the Studio footer, verify `http://127.0.0.1:3100/mcp`, then **Sync project**. AI Design Canvas discovers tools dynamically and projects the document into OpenPencil through its code-to-design API instead of mutating private `.op` internals.

The web core remains functional when OpenPencil is offline.

## Optional hosted vision

Core screenshot/sketch ingestion works locally and does not upload images. To enable the explicit **AI interpret** action, configure server-side environment variables:

```bash
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-5.6-terra
```

The browser never receives the API key. The server route sends only the selected compressed reference, uses `store: false`, and requests strict JSON-schema output that is converted into editable structured nodes.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

No API key is required for the local planner, reference analyzer, canvas, codegen, or OpenPencil localhost bridge.

## Vercel

The project is a Next.js App Router application deployed from the Git-linked repository. Project state is currently browser-local; no database is needed for the single-user/local-first baseline. Optional provider credentials stay in Vercel environment variables.

## Roadmap

The implementation roadmap lives in [`docs/ROADMAP.md`](./docs/ROADMAP.md). The capability/definition-of-done matrix lives in [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md). Do not treat this condensed README list as the final product scope.

## License and provenance

Original code in this repository is MIT licensed. See `LICENSE` and `THIRD_PARTY_NOTICES.md` for provenance and conceptual-inspiration notes.
