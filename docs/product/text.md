---
summary: Defines text as live editable design content with durable styling, transform behavior, tracking units, font controls, and export-time outlining.
read_when:
  - changing text node creation, styling, tracking, transform, save/load, or export behavior
  - deciding whether a text operation should preserve live text or bake outlines
  - debugging text that changes appearance between editing, canvas rendering, and export
---

# Text

Text nodes store editable text, not baked outlines.

## Contract

- Text preserves font, size, fill, stroke, tracking, warp, and transform.
- Text can be transformed like any other node while remaining editable.
- Stroke uses the default centered text-shape model.
- Text remains text through editing, transform, save/load, copy/paste, and
  normal document workflows.
- Export may outline text, but editing surfaces keep source text.

## Tracking

- Tracking is expressed in `1/1000 em`.
- Tracking resolves relative to current font size at layout time.
- Tracking applies evenly while remaining proportional to type size.
- Extreme negative tracking may compress text but must not invert glyph order or
  make visual centering drift away from laid-out glyph positions.

## Controls

- Font size, tracking, stroke width, and path settings support direct numeric
  entry.
- Scrub controls are allowed when bounded values make interaction faster.
- Future typography controls should carry through to editing mode when they
  become product behavior.
