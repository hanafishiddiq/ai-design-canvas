# Repository Manifest and Mapping

AI Design Canvas does not need unrestricted source-code access to discover a production repository.

Run the static scanner from the AI Design Canvas checkout:

```bash
npm run repo:scan -- --root ../your-production-app --out ../your-production-app.adc-repo.json
```

The scanner ignores build/vendor directories and records only metadata required for mapping:

- file paths + SHA-256 hashes;
- framework hints;
- routes from Next.js app/pages and JSX Route declarations;
- exported component symbols;
- CSS custom properties;
- asset names/hashes.

Import the JSON through **Repo** in the web app. Mapping proposals are previews and only high-confidence route/symbol matches are applied when explicitly requested. The manifest contains source metadata, not source file contents.
