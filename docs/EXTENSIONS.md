# Extensions

Extension schema v1 is deliberately declarative. It cannot execute third-party JavaScript.

Supported contributions:

- **Foundations**: a built-in base foundation plus direction/token overrides and DESIGN.md guidance.
- **AI skills**: reusable bounded instructions that open AI Edit for selection/page refinement.

This protects the editor from arbitrary-code supply-chain plugins while establishing a stable manifest contract.

Example: `examples/extensions/editorial-saas.json`.

Future executable integrations should run out-of-process through permissioned MCP/plugin boundaries rather than arbitrary browser eval.
