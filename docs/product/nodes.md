---
summary: Defines the shared PunchPress node model for identity, source kind, empty layers, layer order, visibility, transform, editability, containers, direct editing, and future node growth.
read_when:
  - adding a new node type or changing shared node behavior
  - changing selection, transform, visibility, copy/paste, properties, rasterization, or direct-edit entry for multiple node families
  - deciding whether a feature belongs on a node, a container, an editing mode, or export-only output
---

# Nodes

Nodes are the building blocks of PunchPress documents.

## Shared Contract

- Every design element on the canvas is a node.
- Nodes have stable identity, layer order, visibility, and transform.
- Nodes remain editable source content until export.
- Nodes can be selected, copied, pasted, hidden, transformed, and, when
  appropriate, directly edited.
- Multi-selection property controls show shared values and mixed states rather
  than guessing.
- Container nodes own child layers while behaving as first-class canvas objects.

## Source Kind

Each node exposes a source kind through the engine capability layer. Source kind
is the tool-routing contract for operations that only apply to certain content
models.

| Source kind | Node families |
| --- | --- |
| `empty` | New layers before their first content action. |
| `raster` | Image nodes. |
| `vector` | Shape, path, and vector nodes. |
| `text` | Text nodes. |
| `container` | Group nodes. |
| `artboard` | Artboard nodes. |

Brush operates directly on `raster` nodes. When Brush targets an `empty` layer,
PunchPress materializes that layer as raster content. Rasterizing existing
vector, text, group, or artboard content is a separate capability.

## Direct Editing

- Editable nodes enter direct editing through explicit user intent, usually the
  Node tool, a hotkey, or double-click.
- Direct editing keeps node selection context instead of replacing it with a
  separate hidden object model.
- While direct editing is active, editing affordances become primary and normal
  object transform chrome may be hidden.
- Marquee selection targets the active editing domain, such as path points, not
  unrelated canvas nodes.

## Growth Rules

- New node types should fit the same mental model: selectable object, clear
  bounds, direct manipulation, and editable source data where applicable.
- Parametric shapes stay one shape node family with a shape-kind field while
  their interaction model is shared.
- Path nodes are first-class durable nodes.
- Vector nodes preserve editable source geometry rather than only SVG path
  strings.
- Image nodes preserve raster source artwork instead of pretending bitmap pixels
  are editable vector content.
- New containers make containment explicit in the node contract.
- Specialized editing subsystems may exist, but PunchPress remains the durable
  owner of node data.
