---
summary: Defines recent-document behavior for file-backed PunchPress tabs and explicitly excludes scratchpad activity.
read_when:
  - changing recent documents menus, browser recent storage, desktop recent documents, or open-recent command routing
  - debugging scratchpad entries or duplicate file-backed tabs in recent-document surfaces
---

# Recent Documents

Recent documents track file-backed PunchPress documents.

- Opening or saving a file-backed document can update recent documents.
- Opening a recent document creates or focuses a file-backed tab.
- The scratchpad never participates.
- Duplicate entries should resolve by file identity when available.
- Browser and desktop recent-document surfaces route to the same active-tab
  document model.
