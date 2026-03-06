# AGENTS.md

MerchBase Core is a Bun-workspace monorepo for a canonical merch products and sales data platform with an API, typed client, and CLI. The core runtime stack is Fastify, tRPC, Caddy, Postgres, and pg-boss.
This file is the quick-reference for code style and a short index to scoped docs.

## Code Style Guidelines

### Cross-Cutting

1. Use local import paths with `.js` extension for internal TS modules in runtime packages (NodeNext ESM). In dashboard bundler code (`apps/dashboard/src/*`), prefer extensionless local imports.
2. Use kebab-case file names.
3. Prefer `const` + arrow function style for new functions/components.
4. Keep files cohesive and focused; target under ~300 LoC and split when responsibilities diverge.
5. Keep main exports/core flow near the top; keep helpers near the bottom.
6. Avoid unnecessary barrel files; keep explicit package entrypoints only where needed (`src/index.ts`).
7. Use the repo-standard Biome + Ultracite configuration (`biome.json` + `bun run lint`).

### TypeScript

1. Prefer inference from tRPC/Zod/SQL where possible; avoid redundant manual types.
2. Validate external input at boundaries with Zod.
3. Keep null/error handling explicit; avoid unsafe casts and silent catches.
4. Use exhaustive checks for discriminated unions/switches.
5. Prefer explicit failures when runtime assumptions/contracts are broken.
6. Export only what is actually used externally.

### API and tRPC (`apps/server/src/api/*`)

1. Keep procedures focused on one capability with stable slash-style keys.
2. Procedure guards must match router namespace intent:
- `publicApiProcedure` for `api.public`.
- `appProcedure` for `api.app`.
- `adminProcedure` for `api.admin`.
3. Keep transport layers thin: routers should validate/auth/route, not own orchestration.
4. Avoid UI-formatting logic in heavy query modules.
5. Prefer domain/service modules for external HTTP calls and business workflows.
6. For dashboard data access, use tRPC React Query hooks (`api.app["route/key"].useQuery(...)` / `.useMutation(...)`) instead of manual `fetch` or proxy `.query()` wrappers.
7. For realtime dashboard updates, keep subscription procedures in the same router namespace as the queries they affect.

### React/Dashboard (`apps/dashboard/src/*`)

1. Keep components mostly presentational; isolate data access/orchestration in hooks.
2. Effects are for external synchronization, not derived state.
3. Put API hooks in `hooks/api/*`; compose page/feature hooks from smaller API/domain hooks.
4. Name hooks by user-facing action/outcome, not backend route shape.
5. Centralize mutation side effects (optimistic behavior, invalidation, toasts) in hooks/action modules.
6. Let server data be source of truth; optimistic flows need explicit rollback/error handling.
7. Persist user-visible navigation/filter/sort/pagination state in stable boundaries when it should survive navigation/refresh.
8. Prefer shared UI primitives in `components/ui/*` over bespoke reimplementation.
9. Prefer declarative metadata/config for repeated UI systems (tables/filters/editors).
10. Make data freshness behavior explicit (`staleTime`, refetch behavior, subscriptions, placeholder data).
11. Prefer one primary component per file; small tightly-coupled presentational helpers are acceptable when splitting hurts readability.
12. Keep invalidation logic in the domain hook that owns the subscription/mutation; avoid shared cross-domain invalidation hooks.

### UI Components and Design System

1. Use a shadcn-style local component system: components live in `src/components/ui/*`, are copied into the repo, and are owned locally.
2. Base UI is the only primitive/component foundation for new shared UI work; do not add new Radix UI dependencies or build new shared components on Radix primitives.
3. COSS UI is the source of truth for new shared components and patterns. Start from the COSS UI docs/registry, then adapt the component into the local `src/components/ui/*` layer.
4. Prefer extending the existing local wrapper/component API over importing Base UI primitives directly in feature code.
5. Keep design-system guidance in `@docs/design-system.md` and update it when the component workflow or source-of-truth changes.

### Jobs and Ingestion (`apps/server/src/jobs/*`)

1. Prefer job-first orchestration: API routes enqueue or record intent; jobs own scheduling, retries, and coordination.
2. Keep pg-boss lifecycle wiring in one clear runtime entrypoint (`apps/server/src/jobs/runtime.ts`).
3. Define jobs in per-job files with explicit input/options/work and register via `apps/server/src/jobs/register.ts`.
4. Keep jobs code direct and functional; avoid class-heavy orchestration abstractions.
5. Design jobs for idempotency and deduplication so retries/restarts are safe.
6. Close lifecycle flags/locks in `finally`-equivalent paths.
7. Use concrete verb-first names for queues/files/exports.
8. When account/session resources are singleton, replacement and revocation behavior must be explicit and immediate.

### SQL and Data (`apps/server/src/db/*` and query modules)

1. Keep SQL composable and filter-driven; avoid hard-coded account assumptions.
2. Enforce account scoping in every domain query that reads account data.
3. Convert DB numerics/dates carefully at query boundaries.
4. Keep boundary mappers explicit between DB/external payloads and domain types.

### Time and Timezones

1. Treat `@docs/time.md` as the canonical time contract.
2. Server is the only runtime that computes Merch day boundaries, day labels, and fetch windows.
3. Ingestion client and extension are transport layers for Merch time values; they must not derive Merch windows/dates from local clocks.
4. Dashboard displays Merch timestamps as provided by server; avoid browser-local timezone conversion for Merch data.
5. Exception: operational telemetry/event-log timestamps may be stored in UTC and rendered as relative time.
6. Keep Merch time math in shared time utilities; avoid ad-hoc `Date`/`Intl`/date-library logic in feature modules.

### Logging and Event Log Taxonomy

1. Use operation-focused action names; do not encode outcome in action naming.
2. Keep outcome in `status` + `level`.
3. Keep `1 action = 1 event flow`; if initiator/context differs, use explicit action variants.
4. Every fatal job catch path must emit `job.fatal` with run context and input/error details.
5. Logging writes must be fail-open in business paths.
6. Keep taxonomy/API contracts in `@docs/logging-events.md`.

### Realtime Dashboard Events (tRPC WS)

1. This section is for server-dashboard realtime subscription events, not persisted event log rows.
2. Keep subscriptions in the same API namespace as the data they invalidate (for example: `api.app.events.*`, `api.app.ops.clients.*`).
3. Trigger invalidation in the colocated dashboard hook for that namespace.
4. Prefer explicit event methods (for example `onClientsUpdated`, `onEventLogsUpdated`) over generic shared event payloads like freeform `reason` strings.

## Working Agreements

### Change Scope

- Prefer the smallest end-to-end change that resolves the issue.
- For bug fixes, patch the narrow failing path first.
- Generalize only when there is a concrete second use case.
- Avoid speculative abstractions/extension points.
- Avoid adding legacy/compatibility code paths unless explicitly requested.
- Add or update focused tests when behavior changes.

### If Unsure

- Ask before changing API surface semantics.
- Never guess auth behavior; verify against `api.context` and router guards.
- If requirements are unclear, add an explicit open-question note in the relevant `docs/*` spec and ask before implementation.

### Required Maintenance

1. Keep docs current when API shape, jobs, or storage models change.
2. Keep startup status logging intact in `apps/server/src/index.ts` when adding features/jobs.
3. Keep secrets out of version control.
4. Update `.env.example` when environment variables change.
5. Keep docs anchored to source-of-truth code/config; avoid mirroring executable facts in prose.

### Commit Format

Use Conventional Commit style: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`.

## Docs Index (`@docs`)

Use these scoped docs for everything outside code style:

- `@docs/README.md` (full docs index)
- `@docs/design-system.md` (shared UI system, Base UI policy, and COSS UI workflow)
- `@docs/api-surfaces.md` (API surface split boundaries and invariants)
- `@docs/logging-events.md` (event taxonomy, logging invariants, and query contracts)
- `@docs/merch-api-knowledge.md` (external Merch API quirks and integration behavior memory)
- `@docs/merchbase-cli-spec.md` (CLI contract semantics and constraints)
- `@docs/time.md` (timezone and day-boundary contract)
