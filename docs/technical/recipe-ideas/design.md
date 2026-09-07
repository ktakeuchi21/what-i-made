# Recipe Ideas Technical Design

## System boundary

The PWA owns saved recipes, optimized source images, drafts, search/filter state, and links to cooking attempts. A separate protected Recipe Ideas Lambda performs bounded network work. It has no database and does not retain recipe content. The existing owner token protects every route; the static app contains no service credential.

The deployed HTML supplies the public HTTPS Recipe Ideas endpoint through the `wim-recipe-endpoint` meta value. An empty or invalid value disables network actions while leaving saved Ideas and manual entry usable. The endpoint is configuration, not a credential.

## Local data

IndexedDB version 4 adds `ideas`, `ideaImages`, and transient `ideaDrafts`. `ideas.canonicalSourceUrl` is unique and omits a key for manual/generated entries. `ideaImages.ideaId` is unique. New attempts may contain `sourceIdeaId`; Made is derived rather than stored. Existing records are not rewritten. Portable backups include saved Ideas and images but exclude drafts.

Backup schema version 2 serializes the six persistent stores—occasions, dishes, attempts, cooking photos, Ideas, and Idea images—to a portable JSON blob with base64 image fields. Validation checks schema, counts, unique identities, Idea/image and Idea/attempt references, and required image data before opening a write transaction. Restore refuses a non-empty archive and writes all stores atomically; `ideaDrafts` is never exported.

An Idea stores stable identity, normalized title, recipe text arrays, optional description/yield/times/notes, source kind, canonical and display URL, publisher/author, image reference, and timestamps. Refresh keeps its ID, creation timestamp, attempt links, and personal notes.

## Service contract

- `POST /v1/recipes/import` accepts one public HTTPS URL. It returns normalized Recipe data plus a five-minute signed image token when available.
- `POST /v1/recipes/search` accepts a bounded English description and returns at most three cited public recipe candidates through an injected grounded-search provider.
- `POST /v1/recipes/generate` returns a schema-validated recipe labeled `generated`, without a remote photograph.
- `GET /v1/recipes/image?token=…` verifies the token and returns a bounded JPEG, PNG, or WebP for on-device optimization.

All JSON responses are `Cache-Control: no-store`. The deployed origin owns exact CORS configuration. Errors use stable unauthorized, disabled, invalid-request, unsupported, unavailable, and timeout categories without echoing private input.

## Trust and failure behavior

The importer accepts HTTPS on port 443 only, rejects credentials and non-public/reserved addresses, resolves and pins an approved address, repeats validation on every redirect, limits redirect count, MIME types, HTML/image bytes, and total duration, sends no cookies, and never executes page scripts. JSON-LD is parsed inertly and normalized as plain text. Search/provider output is treated as untrusted and schema-validated. Page bodies, URLs, descriptions, recipes, and image bytes are excluded from logs.

The client persists an editable draft before review. Network loss, malformed pages, missing images, provider failure, and quota failure leave existing saved data unchanged. Missing source images use a local placeholder; generated recipes never invent a food photograph.

## Proof

Pure model tests cover URL normalization, duplicate behavior, recipe validation, search/filter ordering, and Made derivation. Service tests cover Recipe JSON-LD shapes, authorization, signed images, redirects, DNS rebinding, private ranges, MIME and byte limits, timeouts, sanitization, provider schema, and prompt-like page content. Browser checks prove the two input flows, AI fallback, local save, capture linkage, refresh/delete behavior, back restoration, accessibility, offline reads, console cleanliness, and phone layouts.
