---
summary: Defines clipboard payload precedence for PunchPress-owned content, plain text, future image payloads, paste identity, placement, and unsupported payload no-ops.
read_when:
  - changing clipboard serialization, paste interpretation, external payload support, paste offsets, or text-field copy behavior
  - debugging paste that flattens editable content, chooses plain text over native payloads, or reuses node ids
---

# Clipboard Formats

Clipboard interpretation chooses the highest-fidelity supported payload.

## Precedence

1. PunchPress-owned editable payload.
2. Supported external image or file payload.
3. Plain text.
4. Unsupported payload: no-op.

## PunchPress Payloads

- Preserve editable source data, styling, relative layout, layer order, and
  parent-child relationships.
- Create new node ids on every paste.
- Preserve internal relative geometry.
- Offset same-document repeated paste predictably.

## External Payloads

- Plain text becomes a text node.
- Supported image/file payloads should become corresponding nodes when those
  node types exist.
- Generic representations of native PunchPress payloads should not win over the
  native payload.
