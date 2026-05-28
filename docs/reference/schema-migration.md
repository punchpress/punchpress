---
summary: Captures schema versioning expectations for `.punch` load, normalization, migration, explicit saved fields, and validation failures.
read_when:
  - changing document version, migration code, normalizers, or saved node defaults
  - deciding how an older `.punch` file should load into the current schema
  - debugging a document that loads with fallback data or rejects missing fields
---

# Schema Migration

PunchPress documents are versioned and validated on load.

## Rules

- The current schema version is `1.8`.
- Saved documents should be explicit and canonical.
- Missing required fields are validation errors unless migration owns the
  upgrade.
- Runtime renderers should not invent saved document values.
- Migration converts older valid documents into the current explicit shape.
- Normalization may canonicalize supported data but must not hide invalid
  structure.

## Ownership

| Concern | Package |
| --- | --- |
| constants | `packages/punch-schema/src/constants.ts` |
| schema | `packages/punch-schema/src/schema.ts` |
| load | `packages/punch-schema/src/load.ts` |
| save | `packages/punch-schema/src/save.ts` |
| migration | `packages/punch-schema/src/migrate.ts` |
| normalization | `packages/punch-schema/src/normalize.ts` |

## Migration Policy

Add a migration when existing user documents need to keep loading. Do not add
compatibility aliases for fields that never shipped or are not actively needed.
