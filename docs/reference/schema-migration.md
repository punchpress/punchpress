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

- The current schema version is `1.9`.
- `1.8` documents and clipboard payloads upgrade on load: flat `fill`,
  `stroke`, `strokeWidth`, and path stroke style fold into a one-layer
  appearance stack (text and shape strokes take round cap/join and miter 4;
  miter limits below 1 become 4; `none`/`transparent` mean no layer; color alpha
  becomes layer opacity).
- Saved documents should be explicit and canonical.
- `1.7` and older are unsupported and fail to load.
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
product decision to support that older file family. The 1.8 → 1.9 appearance
upgrade is such a decision. Later appearance stages bump the version with
minimal passthrough steps; versioning resets before the first real release.
