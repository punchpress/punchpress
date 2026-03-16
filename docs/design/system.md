# Design System

## Summary

This repo uses a shadcn-style component system with local components in `src/components/ui/*`.
We copy components into the repo, own the implementation locally, and adapt them to the product as needed.

For shared UI primitives and component behavior, Base UI is the only foundation we use.
Radix UI is not part of the active design system and should not be introduced for new work.

## Source of Truth

New shared components should come from COSS UI first:

- Docs and component catalog: `https://coss.com/ui/`
- LLM index: `https://coss.com/ui/llms.txt`

COSS UI is built on Base UI and Tailwind CSS, which matches the component model already used in this repo.

## Working Rules

1. Prefer existing local components from `src/components/ui/*` over bespoke feature-level implementations.
2. When a shared component does not exist yet, start from the closest COSS UI component or pattern, then adapt it into `src/components/ui/*`.
3. Keep Base UI imports inside the shared UI layer whenever practical. Feature code should usually consume the local wrapper components instead.
4. Do not add Radix UI packages, Radix-based examples, or Radix-specific APIs for new shared UI work.
5. Keep styling aligned with the existing Tailwind and shadcn-style token usage in the repo.

## Migration Guidance

If you find older references to Radix UI in docs, examples, or dependencies, treat them as stale unless the source code proves otherwise.
The intended direction is:

- local `src/components/ui/*` ownership
- Base UI primitives and helpers
- COSS UI as the upstream source for new components
