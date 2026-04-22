# Document Model

PunchPress stores every design as a JSON document: a design recipe. This
document is the source of truth for rendering, editing, saving, loading, AI
generation, and export.

The goal of the model is not to capture every future feature up front. The goal
is to define a clean, durable shape that matches how we want to think about
designs.

## Principles

- Flat nodes. Each node stores its own persistent properties inline.
- String IDs, explicit references. Relationships use string IDs, never array
  positions.
- What you store is what you think in. The JSON in memory is the JSON on disk.
- Version the schema. Every document carries an explicit version.
- Document state is not session state. Selection, zoom, hover, tools, and
  caches are not persisted.
- No omitted fields for saved documents. A valid document is explicit and
  canonical.
- Transforms are separate from content. Position, rotation, and scale do not
  mutate text content, live shape meaning, or path segment data.
- One node, one durable responsibility. Complex vector objects use explicit
  container nodes and child nodes rather than hidden secondary models.
- Live until export. Source text, shape data, path data, and compound
  composition remain editable source content inside the document.
- Deterministic and validatable. The same document should produce the same
  result for a given renderer version, and malformed data should be rejected
  early.

## Current Schema

The current document version is `1.7`.

```ts
type DesignDocument = {
  version: "1.7";
  nodes: Node[];
};

type Node = TextNode | ShapeNode | GroupNode | VectorNode | PathNode;

type NodeParentId = "root" | string;

type BaseNode = {
  id: string;
  parentId: NodeParentId;
  visible: boolean;
};

type Transform = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};
```

### Group Node

```ts
type GroupNode = BaseNode & {
  type: "group";
  name: string;
  transform: Transform;
};
```

### Text Node

```ts
type TextNode = BaseNode & {
  type: "text";
  text: string;
  font: LocalFont;
  fontSize: number;
  tracking: number;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  warp: Warp;
  transform: Transform;
};
```

### Shape Node

```ts
type ShapeNode = BaseNode & {
  type: "shape";
  shape: "polygon" | "ellipse" | "star";
  width: number;
  height: number;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  transform: Transform;
};
```

### Vector Node

```ts
type VectorNode = BaseNode & {
  type: "vector";
  name: string;
  compoundWrapper?: boolean;
  pathComposition?:
    | "independent"
    | "compound-fill"
    | "unite"
    | "subtract"
    | "intersect"
    | "exclude";
  transform: Transform;
};
```

### Path Node

```ts
type PathNode = BaseNode & {
  type: "path";
  closed: boolean;
  fill: string | null;
  fillRule: "evenodd" | "nonzero";
  stroke: string | null;
  strokeWidth: number;
  strokeLineCap: "butt" | "round" | "square";
  strokeLineJoin: "miter" | "round" | "bevel";
  strokeMiterLimit: number;
  segments: VectorSegment[];
  transform: Transform;
};
```

## Structural Rules

- `nodes` is an ordered array.
- Array order is tree order.
- Root-level nodes use `parentId: "root"`.
- `path` nodes may live at the root or under a `vector` node.
- `vector` nodes may only contain `path` children.
- A standalone `path` node is a first-class canvas object.
- A `vector` node is a container object for child paths that need one shared
  selection, transform, or composition surface.
- Child paths own their geometry and path styling.
- Parent vectors own child-path composition semantics.
- The document stores editable source geometry, not compiled render surfaces,
  edit-overlay state, or third-party runtime objects.

## Vector Semantics

PunchPress uses two explicit vector building blocks:

- `path` for authored curve geometry
- `vector` for multi-path composition

That split keeps the saved model simple:

- a single drawn path can stay as one standalone `path` node
- a compound or grouped vector object becomes one `vector` node with child
  `path` nodes
- a path's `fillRule` controls its own winding behavior
- a vector's `pathComposition` controls how its child paths combine

## Validation

A stored document must be fully explicit.

- Missing required fields are validation errors.
- The renderer should not invent document values on the fly.
- Parent-child constraints are part of validation, not just renderer
  convention.

## What Is Not Stored

The document stores persistent design data only.

It does not store transient editor session state or derived renderer data. That
includes:

- selection, hover, viewport, and active tool state
- temporary drag, rotate, or resize previews
- compiled SVG render surfaces
- Paper sessions, edit handles, guides, and similar backend-local state

## Example Compound Object

This is a simplified example of a non-destructive compound object in the
document:

```json
{
  "version": "1.7",
  "nodes": [
    {
      "id": "vector_1",
      "type": "vector",
      "parentId": "root",
      "visible": true,
      "name": "Compound",
      "pathComposition": "unite",
      "transform": {
        "x": 0,
        "y": 0,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      }
    },
    {
      "id": "path_1",
      "type": "path",
      "parentId": "vector_1",
      "visible": true,
      "closed": true,
      "fill": "#ff0000",
      "fillRule": "nonzero",
      "stroke": null,
      "strokeWidth": 0,
      "strokeLineCap": "butt",
      "strokeLineJoin": "miter",
      "strokeMiterLimit": 4,
      "transform": {
        "x": -40,
        "y": 0,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      },
      "segments": [
        {
          "point": { "x": 0, "y": -40 },
          "handleIn": { "x": 0, "y": -40 },
          "handleOut": { "x": 0, "y": -40 },
          "pointType": "corner"
        }
      ]
    },
    {
      "id": "path_2",
      "type": "path",
      "parentId": "vector_1",
      "visible": true,
      "closed": true,
      "fill": "#ff0000",
      "fillRule": "nonzero",
      "stroke": null,
      "strokeWidth": 0,
      "strokeLineCap": "butt",
      "strokeLineJoin": "miter",
      "strokeMiterLimit": 4,
      "transform": {
        "x": 40,
        "y": 0,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      },
      "segments": [
        {
          "point": { "x": 0, "y": 40 },
          "handleIn": { "x": 0, "y": 40 },
          "handleOut": { "x": 0, "y": 40 },
          "pointType": "corner"
        }
      ]
    }
  ]
}
```
