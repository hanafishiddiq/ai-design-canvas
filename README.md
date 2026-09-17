# AI Design Canvas

AI Design Canvas is an open-source, design-first product workbench that combines the strongest ideas from **OpenStitch-style design intelligence** with an **OpenPencil-ready structured canvas model**.

The current MVP is intentionally Vercel-friendly: the web editor works without an AI API key or native daemon, while a clean adapter boundary allows a local/remote OpenPencil headless or MCP engine to become the authoritative renderer later.

## What already works

- Prompt → coherent 4-screen product plan with deterministic local generation.
- Curated design foundations inspired by the public visual characteristics of Linear, Stripe, Vercel, Attio and Raycast.
- Style mixer: foundation, treatment, density, radius, motion, theme and accent.
- Typed, JSON-serializable design document with pages, nodes, tokens and prototype flows.
- First-class `DESIGN.md` generation, editing, parsing/import and export.
- Interactive multi-screen canvas with pan, zoom, frame dragging and node dragging.
- Node inspector for content, geometry, typography, color, spacing and radius.
- Prototype navigation edges plus Play mode.
- Deterministic anti-slop audit with safe auto-refinement.
- Project JSON, selected-screen HTML and OpenPencil bridge JSON exports.
- Local persistence via an abstract `ProjectRepository` interface.
- `OpenPencilAdapter` abstraction with local and HTTP implementations.

## Architecture

```text
Product prompt / DESIGN.md / style mixer
                  │
                  ▼
        Design intelligence layer
     foundations · planner · anti-slop
                  │
                  ▼
         Portable design contract
               DESIGN.md
                  │
                  ├────────────────────┐
                  ▼                    ▼
       Structured design model   Agent context
       pages · nodes · tokens     Codex/Claude/etc.
                  │
                  ▼
        Interactive web canvas
       pan · zoom · edit · flows
                  │
          ┌───────┴────────┐
          ▼                ▼
     Local adapter     OpenPencil adapter
                       MCP/headless/HTTP
          │                │
          └───────┬────────┘
                  ▼
        JSON / HTML / codegen
```

The key architectural decision is that **`DESIGN.md` and the structured document are separate on purpose**:

- `DESIGN.md` is the portable design intent and machine-readable token contract that arbitrary coding agents can understand.
- The structured document is the editable spatial state used by the canvas and eventual OpenPencil engine.

## Core modules

| Module | Responsibility |
| --- | --- |
| `src/lib/foundations.ts` | Foundation presets, style mixing and token generation |
| `src/lib/design-md.ts` | `DESIGN.md` serialize/parse/merge bridge |
| `src/lib/planner.ts` | Local deterministic prompt → multi-screen planner |
| `src/lib/anti-slop.ts` | Audit rules and safe refinement patches |
| `src/lib/types.ts` | Git-friendly structured design document model |
| `src/lib/openpencil-adapter.ts` | Local/HTTP adapter contract for an OpenPencil engine |
| `src/lib/storage.ts` | Persistence abstraction and local implementation |
| `src/lib/export.ts` | Project/screen export helpers |
| `src/components/workspace.tsx` | Canvas, inspector, style mixer, flow and prototype UI |

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

## OpenPencil strategy

OpenPencil's modern editor/core is substantially more capable than a simple React component and may involve native/Rust/CanvasKit/headless infrastructure. Running that directly inside Vercel serverless would make the product fragile.

This repository therefore exposes an adapter boundary:

```ts
interface OpenPencilAdapter {
  load(project: DesignProject): Promise<void>;
  save(): Promise<DesignProject>;
  applyPatches(patches: DesignPatch[]): Promise<void>;
  export(format: "json" | "openpencil-bridge"): Promise<string>;
}
```

Today the web app uses `LocalDesignAdapter`. `HttpOpenPencilAdapter` is the seam for a local desktop bridge, remote headless service, or MCP-backed daemon. This lets the Vercel UI stay stateless/serverless-safe while still supporting a richer OpenPencil engine later.

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

No API key is required for the current MVP.

## Vercel

The project is a normal Next.js App Router application and is safe to deploy from the Git-linked repository. The default MVP keeps generated project state in browser local storage, so no database or secret is required.

Optional future provider/bridge variables are documented in `.env.example`.

## Roadmap

1. Connect a real OpenPencil MCP/headless process to `HttpOpenPencilAdapter`.
2. Add screenshot/sketch → semantic design plan ingestion.
3. Add component/instance semantics and auto-layout constraints to the internal document.
4. Add provider adapters for model-backed product planning and visual critique while retaining the local fallback.
5. Add authenticated cloud projects, collaboration and comments.
6. Add production-code round-trip and screenshot visual QA.
7. Add larger foundation/skill libraries with explicit provenance and licensing metadata.

## License and provenance

The original code in this repository is MIT licensed. See `LICENSE` and `THIRD_PARTY_NOTICES.md` for provenance and conceptual inspiration notes.
