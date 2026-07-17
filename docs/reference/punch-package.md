---
summary: Defines the `.punch` package layout, asset table, raster payload rules, image node asset references, and package integrity contract.
read_when:
  - changing `.punch` file packaging, document assets, image node asset references, or raster payload storage
  - debugging a saved file that loses images, writes oversized JSON, breaks image export defaults, or cannot resolve asset refs
---

# Punch Package

`.punch` is a ZIP-based project package. The package stores document metadata
as JSON and stores binary assets as normal files.

## Package Layout

```text
design.punch
  mimetype
  document.json
  assets/
    raster/
      asset_1.jpg
      asset_2.png
```

`mimetype` contains:

```text
application/vnd.punchpress.document
```

## Document Root

```ts
type DesignDocument = {
  version: string;
  assets: Record<string, DocumentAsset>;
  nodes: Node[];
};
```

`document.json` is the source of truth for design structure. Package file paths
are referenced by asset records.

## Raster Assets

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
} & (
  | {
      storage: "single";
      ref: string;
    }
  | {
      storage: "tiled";
      baseRef?: string;
      tileSize: number;
      tiles: Array<{
        col: number;
        row: number;
        x: number;
        y: number;
        width: number;
        height: number;
        ref: string;
        mimeType?: "image/jpeg" | "image/png";
      }>;
    }
);
```

Rules:

- Imported JPEG assets can remain JPEG while untouched.
- Imported PNG assets can remain PNG while untouched.
- Pixel edits write a new current raster payload.
- Pixel edits that require alpha write an alpha-capable payload.
- PNG is the default payload for edited raster assets.
- Large or actively edited raster assets may use tiled storage. Tile refs point
  to normal package files under `assets/raster/`; there is no monolithic current
  payload for tiled assets.
- Brush-authored raster layers save as pure-tiled assets: no `baseRef`, one
  self-complete tile payload per painted store tile, and `tiles` may be empty
  for a fully-erased layer.
- `baseRef` appears only on legacy mixed assets (saved before the node's first
  store-backed brush commit). The base payload renders first; tile payloads
  overlay changed regions. The node's next brush commit migrates it to the
  pure-tiled shape.
- Export defaults to `preferredExportMimeType` only when it can represent the
  current raster state.

## Image Nodes

```ts
type ImageNode = {
  id: string;
  type: "image";
  assetId: string;
  width: number;
  height: number;
  baseX?: number;
  baseY?: number;
  baseWidth?: number;
  baseHeight?: number;
  transform: Transform;
};
```

`width` and `height` are canvas dimensions. For brush-authored raster layers,
they match the current bounded pixel payload. `baseX`, `baseY`, `baseWidth`,
and `baseHeight` are legacy fields: they place a legacy mixed asset's base
payload inside a tiled image node's logical bounds and disappear when the node
migrates to the pure-tiled shape. Tile `x` and `y` values use the node's local
coordinate space.

## Runtime Hydration

The editor hydrates package raster files into runtime image sources after open.
Runtime image `src` and `tileSources` fields are editor state, scratchpad state,
and history snapshot data. Saved `.punch` package documents strip those runtime
fields and store raster bytes only under `assets/raster/`.

## Integrity

- Asset ids are unique in `document.json`.
- Every image node `assetId` resolves to a raster asset.
- Every single asset `ref` and every tiled asset tile `ref` stays inside the
  package.
- Unknown package files are ignored unless a referenced asset points at them.
- Missing referenced files are load errors.

## Related

- [Punch format](punch-format.md)
- [Schema versioning](schema-migration.md)
- [Image editing](../product/image-editing.md)
- [Raster image editor](../internals/raster-image-editor.md)
