---
summary: Defines the text node family as editable text with font descriptors, tracking, fill, stroke, transform, and warp state.
read_when:
  - changing text node schema, defaults, property support, render behavior, edit behavior, or export conversion
  - deciding whether a text feature belongs in text nodes, font handling, or text warping
---

# Text Nodes

Text nodes are editable text objects.

- Text nodes store source text.
- They own local font descriptor, font size, tracking, fill, stroke, stroke
  width, warp, and transform.
- They render as live text geometry in the editor.
- They remain editable through save/load and normal document workflows.
- Export may convert text to production-ready outlines.

See [Text](text.md), [Text editing](text-editing.md), and
[Text warping](text-warping.md).
