---
summary: Defines the packaged `.punch` document constants, version, root shape, node families, transforms, warps, vector contours, and validation constraints.
read_when:
  - changing `packages/punch-schema/src/schema.ts`, document load/save, or persisted node fields
  - debugging a `.punch` file that fails validation or loses editable source data
  - deciding whether a field belongs in saved document state or transient editor state
---

# Punch Format

`.punch` files are packaged design documents. The package layout is defined in
[Punch package](punch-package.md).

| Constant | Value |
| --- | --- |
| Extension | `.punch` |
| MIME type | `application/vnd.punchpress.document` |
| Current version | `1.8` |
| Root parent id | `root` |
| Default basename | `untitled-design` |

## Root

```ts
type DesignDocument = {
  version: "1.8";
  assets: Record<string, DocumentAsset>;
  nodes: Node[];
};
```

`document.json` stores package-safe design data. Runtime editor snapshots may
hydrate image nodes with transient `src` data URLs; saved package documents do
not store image bytes inline.

`nodes` is ordered tree order. Relationships use string ids and `parentId`.

## Node Families

| Type | Saved responsibility |
| --- | --- |
| `artboard` | Rectangular production surface: name, size, background, lock, transform. |
| `empty` | Named layer placeholder with no rendered content yet. |
| `group` | Named container with transform. |
| `text` | Editable text, local font descriptor, size, tracking, fill, stroke, warp, transform. |
| `shape` | Live polygon, ellipse, or star with size, points, optional corner radius, appearance, transform. |
| `image` | Raster artwork that references a document raster asset. |
| `vector` | Vector object with optional child paths and path composition. |
| `path` | Editable contours, fill rule, stroke style, appearance, transform. |

Image nodes store logical raster bounds with optional base-plane placement for
tiled edits:

```ts
type ImageNode = {
  type: "image";
  assetId: string;
  width: number;
  height: number;
  baseX?: number;
  baseY?: number;
  baseWidth?: number;
  baseHeight?: number;
  writableX?: number;
  writableY?: number;
  writableWidth?: number;
  writableHeight?: number;
  transform: Transform;
};
```

`width` and `height` define the node's logical render, hit, selection, and
transform bounds. `baseX`, `baseY`, `baseWidth`, and `baseHeight` place the base
raster payload inside those logical bounds when sparse tiled edits grow the node
left or upward. `writableX`, `writableY`, `writableWidth`, and
`writableHeight` store a standalone Raster's finite paintable rectangle when it
differs from the logical content bounds. They are omitted for imported images
whose own rectangle is writable. While an image remains Frame-owned, its
writable domain is derived from the Frame; detaching it snapshots that domain
into these fields.

## Common Fields

Every node has:

```ts
{
  id: string;
  parentId: "root" | string;
  visible: boolean;
}
```

Transform:

```ts
{
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}
```

## Text Warps

Text warp kinds:

- `none`
- `arch` with `bend`
- `wave` with `amplitude` and `cycles`
- `slant` with `rise`
- `circle` with `radius`, `sweepDeg`, `pathPosition`, and `inverted`

## Vector Geometry

Vector contours store editable source geometry:

```ts
type VectorContour = {
  closed: boolean;
  segments: VectorSegment[];
};
```

Each segment stores `point`, `handleIn`, `handleOut`, and `pointType`
(`corner` or `smooth`).

Path fill rules are `evenodd` or `nonzero`. Vector path composition is
`independent`, `compound-fill`, `unite`, `subtract`, `intersect`, or `exclude`.
Source-backed vectors may store:

```ts
type VectorSvgSource = {
  type: "svg";
  source: string;
  width: number;
  height: number;
};
```

## Validation Rules

- Documents are strict. Unknown fields are rejected.
- Numeric fields must be finite numbers.
- Node ids must be unique.
- Nodes cannot parent themselves.
- Non-root parents must exist.
- Artboards must live at root.
- Vector nodes may contain only path children.
- Path nodes may live at root, under artboards, under groups, or under vectors.
- Saved documents store durable design data only, not selection, hover, viewport,
  compiled render surfaces, Paper sessions, or overlay state.
- Every image node `assetId` resolves to a raster asset.
- Package `document.json` does not store image `src` fields.
