# Document Model

PunchPress stores every design as a JSON document: a design recipe. This document is the source of truth for rendering, editing, saving, loading, AI generation, and export.

The goal of the model is not to capture every future feature up front. The goal is to define a clean, durable shape that matches how we want to think about designs.

## Principles

- Flat nodes. Each node is self-contained with its own properties inline. You should not need to inspect a distant subtree to understand one node.
- String IDs, explicit references. Relationships use string ID pointers when needed, never array positions.
- What you store is what you think in. The JSON in memory is the JSON on disk. There is no second internal document model.
- Version the schema from day one. Every document carries an explicit version. Schema changes come with explicit migrations.
- Document state is not session state. Nodes and node properties are saved. Selection, zoom, hover, and active tool are not.
- No omitted fields for saved documents. A valid document is explicit and canonical, not dependent on renderer-side defaults.
- Transforms are separate from content. Position, rotation, and scale never mutate text, warp params, or path data.
- One node, one visual element. Composition happens through multiple nodes, not god-nodes.
- The schema is the LLM's API. If a human cannot read the type and immediately understand it, the model is too clever.
- Declarative, not procedural. The document describes what the design is, not how to render it step by step.
- Live until export. Text stays text. Warp stays parameters. Source geometry stays source geometry. Nothing is baked early.
- Deterministic. The same document should produce the same output every time for a given renderer version.
- Validatable. The schema should be strict enough to reject malformed AI output and broken imports before they reach the renderer.

## Current Schema

This section defines the current schema: editable text nodes, parametric basic shape nodes, and structural group nodes.

### Document

```ts
type DesignDocumentV1 = {
  version: "1.2";
  nodes: Node[];
};

type Node = TextNode | ShapeNode | GroupNode;
```

Rules:

- `nodes` is an ordered array.
- Array order is tree order.
- Parent and child relationships use `parentId`.
- Root-level nodes use `parentId: "root"`.
- The document contains only persistent design state.

### Group Node

```ts
type GroupNode = {
  id: string;
  type: "group";
  parentId: NodeParentId;
  visible: boolean;
  transform: Transform;
};
```

### Text Node

```ts
type TextNode = {
  id: string;
  type: "text";
  parentId: NodeParentId;
  text: string;
  font: LocalFont;
  transform: Transform;
  fontSize: number;
  tracking: number;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  visible: boolean;
  warp: Warp;
};

type NodeParentId = "root" | string;

type LocalFont = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
};

type Transform = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

type Warp =
  | { kind: "none" }
  | { kind: "arch"; bend: number }
  | { kind: "wave"; amplitude: number; cycles: number }
  | { kind: "circle"; radius: number; sweepDeg: number };
```

### Shape Node

```ts
type ShapeNode = {
  id: string;
  type: "shape";
  parentId: NodeParentId;
  shape: "polygon" | "ellipse" | "star";
  width: number;
  height: number;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  visible: boolean;
  transform: Transform;
};
```

This is intentionally simple:

- `id` is a stable string ID for identity only. It is not the node's semantic role.
- `type` is explicit.
- `parentId` expresses hierarchy without nesting child arrays inside the stored document.
- `text` is the editable source string.
- `font` stores the resolved local font descriptor used to derive geometry.
- `shape` stores the live shape family while `width` and `height` stay editable source dimensions.
- `transform` holds placement only.
- `warp` is an option on text nodes and holds parametric warp settings only.

## Validation

A stored document must be fully explicit.

- Missing required fields are validation errors.
- The renderer should not invent document values on the fly.
- If schema changes introduce new fields later, migrations for that `version` should materialize them before the document is considered valid.

## What Is Not Stored

The document stores persistent design data only.

It does not store transient editor session state or derived renderer data. That includes things like selection, tool/viewport state, temporary interaction state, and cached geometry.

## Example Document

This is an example `version: "1.2"` document using the current feature set.

```json
{
  "version": "1.2",
  "nodes": [
    {
      "id": "group_1",
      "type": "group",
      "parentId": "root",
      "visible": true,
      "transform": {
        "x": 0,
        "y": 0,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      }
    },
    {
      "id": "node_1",
      "type": "text",
      "parentId": "group_1",
      "text": "BROOKLYN",
      "font": {
        "family": "College Block",
        "fullName": "College Block",
        "postscriptName": "CollegeBlock-Regular",
        "style": "Regular"
      },
      "fontSize": 420,
      "tracking": 10,
      "fill": "#d7b24d",
      "stroke": "#1d2940",
      "strokeWidth": 18,
      "visible": true,
      "transform": {
        "x": 2250,
        "y": 1300,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      },
      "warp": {
        "kind": "arch",
        "bend": 0.42
      }
    },
    {
      "id": "node_shape_1",
      "type": "shape",
      "parentId": "group_1",
      "shape": "polygon",
      "width": 2200,
      "height": 900,
      "fill": "#1d2940",
      "stroke": null,
      "strokeWidth": 0,
      "visible": true,
      "transform": {
        "x": 2250,
        "y": 2620,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      }
    },
    {
      "id": "node_2",
      "type": "text",
      "parentId": "group_1",
      "text": "ATHLETICS",
      "font": {
        "family": "College Block",
        "fullName": "College Block",
        "postscriptName": "CollegeBlock-Regular",
        "style": "Regular"
      },
      "fontSize": 260,
      "tracking": 20,
      "fill": "#ffffff",
      "stroke": null,
      "strokeWidth": 0,
      "visible": true,
      "transform": {
        "x": 2250,
        "y": 3950,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      },
      "warp": {
        "kind": "none"
      }
    }
  ]
}
```

## Behavioral Contract

The schema above implies a few non-negotiable behaviors:

- The renderer is a pure function of the document.
- Group membership changes `parentId`, not child arrays embedded in nodes.
- Editing text updates `text`, not outlined path data.
- Editing a basic shape updates parametric fields, not baked path data.
- Editing a warp updates `warp`, not baked geometry.
- Dragging, rotating, and scaling update `transform`, not content fields.
- Export is the only time PunchPress may bake text into paths or flatten geometry for print.

## Next Shape

When new node types arrive, they should follow the same principles:

- a node has a stable string `id`
- a node has an explicit `type`
- content fields stay editable source data
- transform stays separate
- required fields stay easy to understand

That lets the schema grow without changing the mental model.
