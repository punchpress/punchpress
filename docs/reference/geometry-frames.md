---
summary: Defines render, selection, transform, hit, and edit frames as distinct geometry surfaces that must stay aligned with visible artwork.
read_when:
  - changing node frame queries, selection bounds, hover previews, transform overlays, or hit testing
  - debugging a mismatch between rendered art, selection boxes, transform handles, or click targets
---

# Geometry Frames

PunchPress uses separate geometry surfaces so render, selection, transform, hit
testing, and direct editing can agree without becoming the same object.

| Surface | Purpose |
| --- | --- |
| Render geometry | Visual payload drawn on canvas. |
| Render frame | World placement for render geometry. |
| Selection frame | Bounds and transform for selection and hover chrome. |
| Transform frame | Frame manipulated by resize and rotate affordances. |
| Hit bounds | Picking surface, which may differ from visible bounds. |
| Edit surface | Shape or vector point-edit surface. |

## Rules

- Frames are document-derived unless a gesture is explicitly previewing.
- Active drag/resize/rotate preview stays separate from durable frames.
- Hit testing uses the same transforms as rendering and selection.
- DOM measurement is not the source of truth for normal node frames.
