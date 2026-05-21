---
summary: Defines the `.punch` document constants, version, root shape, node families, transforms, warps, vector contours, and validation constraints.
read_when:
  - changing `packages/punch-schema/src/schema.ts`, document load/save, or persisted node fields
  - debugging a `.punch` file that fails validation or loses editable source data
  - deciding whether a field belongs in saved document state or transient editor state
---

# Punch Format

`.punch` files are JSON design recipes.

| Constant | Value |
| --- | --- |
| Extension | `.punch` |
| MIME type | `application/vnd.punchpress+json` |
| Current version | `1.7` |
| Root parent id | `root` |
| Default basename | `untitled-design` |

## Root

```ts
type DesignDocument = {
  version: "1.7";
  nodes: Node[];
};
```

`nodes` is ordered tree order. Relationships use string ids and `parentId`.

## Node Families

| Type | Saved responsibility |
| --- | --- |
| `artboard` | Rectangular production surface: name, size, background, lock, transform. |
| `group` | Named container with transform. |
| `text` | Editable text, local font descriptor, size, tracking, fill, stroke, warp, transform. |
| `shape` | Live polygon, ellipse, or star with size, points, optional corner radius, appearance, transform. |
| `vector` | Container for child paths and optional path composition. |
| `path` | Editable contours, fill rule, stroke style, appearance, transform. |

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
