---
summary: Defines vector editing as editable path and vector source geometry with object transforms, direct editing, child path focus, and Illustrator-style conventions.
read_when:
  - changing vector object selection, direct edit entry, child path focus, vector transforms, or path-edit mode
  - deciding whether a vector should behave as a standalone path, vector container, compound, or group
  - debugging vector artwork that stops behaving like a first-class canvas object
---

# Vector Editing

Path and vector nodes let users create and edit custom vector artwork directly
on the canvas.

## Objects

- A standalone path is the primary editable curve object.
- A vector node is a container for child paths that act as one object.
- Vectors are used for imported grouped vector artwork, compounds, and multi-path
  objects.
- New drawn paths stay standalone unless they need multi-path behavior.
- Paths and vectors remain editable after save, load, copy, paste, duplicate,
  transform, and export.

## Object Selection

- In the default selected state, paths and vectors move, resize, rotate, layer,
  and edit properties like other nodes.
- A vector selection frame represents the visible vector object, not separate
  frames for every child path.
- Resizing or rotating a vector preserves source editability and child
  relationships.

## Direct Editing

- Direct vector editing is the Node tool's editing state for editable path
  artwork.
- Users enter by double-clicking editable artwork, selecting the Node tool,
  pressing the Node hotkey, or clicking editable artwork while Node is active.
- The action bar does not expose a generic `Edit Path` toggle.
- Pointer selection still selects outer grouped objects unless the user has
  drilled into the group.
- Inside a vector, one child path is focused for point editing at a time while
  the parent vector remains the visual object.

## Relationship To Shapes

- Shapes and vectors feel like one coherent vector editing system.
- Shapes convert to freeform path artwork when edits no longer fit their live
  shape family.
- Vector nodes do not promise shape-specific controls once shape meaning is
  gone.
