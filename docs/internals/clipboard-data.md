---
summary: Explains clipboard state ownership, paste sequencing, PunchPress payload preservation, external payload interpretation, and focus boundaries.
read_when:
  - changing engine clipboard actions, clipboard placement, browser clipboard events, or paste interpretation
  - debugging repeated paste offsets, node id reuse, unsupported payload behavior, or text-field copy/paste conflicts
---

# Clipboard Data

Clipboard behavior is split between browser events and engine-owned payload
interpretation.

## Ownership

- Browser/React captures clipboard events.
- Engine clipboard actions copy selected nodes and paste supported content.
- Clipboard state tracks copied PunchPress payloads and paste sequencing.
- Placement logic chooses visible or stepped paste positions.

## Rules

- PunchPress-owned payloads preserve editable node source data.
- Paste creates new node identities.
- External content is interpreted only when PunchPress supports the payload.
- Text inputs keep normal text clipboard behavior.
