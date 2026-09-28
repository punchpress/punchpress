---
summary: Defines the `.punch` ZIP package, single-payload Raster assets, image references, hydration, and integrity rules.
read_when:
  - changing `.punch` packaging, Raster persistence, image asset references, save, reopen, or package validation
  - debugging a saved file that loses current resident Raster pixels or cannot resolve an asset ref
---

# Punch Package

`.punch` is a ZIP package with JSON structure and binary assets.

```text
design.punch
  mimetype
  document.json
  assets/
    raster/
      asset_1.jpg
      asset_2.png
```

`mimetype` contains `application/vnd.punchpress.document`.

## Document Root

```ts
type DesignDocument = {
  version: string;
  assets: Record<string, DocumentAsset>;
  nodes: Node[];
};
```

## Raster Asset

```ts
type RasterAsset = {
  id: string;
  kind: "raster";
  name: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  colorSpace: "srgb";
  originalMimeType: "image/jpeg" | "image/png";
  currentMimeType: "image/jpeg" | "image/png";
  preferredExportMimeType: "image/jpeg" | "image/png";
  storage: "single";
  ref: string;
};
```

Imported payloads may retain JPEG or PNG. Pixel edits normally write PNG so
alpha remains representable. Before package creation, asynchronous document
serialization snapshots the latest committed retained Canvas revision. Asset
width and height describe its committed intrinsic samples. Raster resize
rewrites the single payload and these dimensions before the next package save.

Each image node references one asset id. Runtime `src` is hydrated from the
asset file on open and stripped from `document.json` on package write.

## Intentional Prototype Break

Prototype assets with `storage: "tiled"`, tile refs, or runtime `tileSources`
are unsupported and may fail validation or load. There is no migration,
compatibility reader, or legacy hydration path.

## Integrity

- Asset ids are unique.
- Every image `assetId` resolves to a Raster asset.
- Every Raster `ref` remains inside the package and names an existing file.
- Unknown unreferenced files are ignored.
- Missing or escaping refs are load errors.

## Related

- [Punch format](punch-format.md)
- [Schema versioning](schema-migration.md)
- [Resident Canvas2D decision](../decisions/raster-resident-canvas-surface.md)
