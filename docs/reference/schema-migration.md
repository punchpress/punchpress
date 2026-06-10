---
summary: Captures schema versioning expectations for `.punch` load, normalization, explicit saved fields, and validation failures.
read_when:
  - changing document version, normalizers, or saved node defaults
  - deciding how an older `.punch` file should load into the current schema
  - debugging a document that loads with fallback data or rejects missing fields
---

# Schema Versioning

PunchPress documents are versioned and validated on load.

## Rules

- The current schema version is `1.8`.
- Saved documents should be explicit and canonical.
- Older schema versions are unsupported and may fail to load.
- Missing required fields are validation errors.
- Runtime renderers should not invent saved document values.
- Normalization may canonicalize supported data but must not hide invalid
  structure.

## Ownership

| Concern | Package |
| --- | --- |
| constants | `packages/punch-schema/src/constants.ts` |
| schema | `packages/punch-schema/src/schema.ts` |
| load | `packages/punch-schema/src/load.ts` |
| save | `packages/punch-schema/src/save.ts` |
| normalization | `packages/punch-schema/src/normalize.ts` |

## Version Policy

Change the schema directly when the product contract changes. Do not add
compatibility aliases or old-version upgrades unless there is an explicit
product decision to support that older file family.
