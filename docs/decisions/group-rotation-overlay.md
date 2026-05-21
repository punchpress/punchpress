---
summary: Preserves the superseded group rotation preview decision and the remaining durable rule that group and multi-selection rotation use the shared transform overlay.
read_when:
  - investigating old group rotation preview behavior
  - deciding whether groups or multi-selections need a dedicated rotation preview surface
  - retiring obsolete transform docs while preserving pointerup stability guarantees
---

# Group Rotation Overlay

Status: Superseded
Date: 2026-03-10

## Context

The original group rotation implementation used a separate preview surface to
hide pointerup jumps in a third-party transform overlay.

PunchPress no longer uses that architecture. The editor uses one custom
transform overlay model for single-node, multi-selection, group, and path-edit
transforms.

## Decision

This decision is superseded by [Transform Interaction Model](transform-interaction-model.md).

The durable rules that remain are:

- multi-selection rotation starts from corner controls
- live selection bounds remain stable through pointerup
- group and multi-selection rotation do not need a dedicated preview surface

## Consequences

Keep this page only as a migration marker while old references are retired. New
transform behavior should follow the shared transform model.
