---
summary: Sets the PunchPress documentation contract: doc categories, frontmatter quality, brevity rules, migration rules, and docs-list expectations.
read_when:
  - adding or moving a Markdown file under docs
  - deciding whether product behavior belongs in product, internals, reference, operations, or decisions
  - reviewing docs that feel repetitive, stale, too long, under-researched, or hard for agents to route
---

# Docs Policy

PunchPress docs exist for knowledge that is hard to recover from code search:
product contracts, ownership boundaries, precedence rules, durable decisions,
file formats, operational workflows, and invariants.

Do not document what a well-named file, function, or test can already tell a
reader.

## Overhaul Workflow

When rewriting or retiring existing docs:

1. Inventory the old page and the relevant source code.
2. Decide the new surface: product, internals, reference, operations, decisions,
   or discard as stale plan.
3. Draft the new doc from evidence, not memory.
4. Tighten the page for brevity and remove duplicated content.
5. Review the page against this policy and the current code.
6. Use a third-party review pass for substantive docs. A subagent is preferred
   when available; otherwise run a separate review prompt focused on stale
   claims, missing hard-earned context, overlap, and excess prose.
7. Run `bun run docs:list` and inspect the summary/read_when output before
   considering the page routed.

The review pass should ask what is wrong, misleading, overlapping, missing, or
too verbose. Do not treat "looks fine" as enough for docs that preserve product
or architecture knowledge.

## Overhaul Completion Contract

The PunchPress docs overhaul is complete only when the final docs tree is the
source of truth and the old tree has been retired.

The final tree is:

- `product/` for user-facing behavior and feature contracts.
- `internals/` for implementation ownership, boundaries, data flow, and
  invariants.
- `reference/` for exact schemas, APIs, command ids, shortcut maps,
  precedence, formats, and coordinate contracts.
- `operations/` for maintainer workflows and recovery commands.
- `decisions/` for accepted architecture tradeoffs and their consequences.
- `docs-policy.md` for the rules that keep these sections short and
  non-overlapping.

Completion requires:

- every durable claim in old `specs/`, `architecture/`, `testing/`, `release/`,
  and `ai-commands/` docs is migrated, intentionally discarded as stale, or
  recorded as a superseded decision;
- old docs directories are deleted after migration so `bun run docs:list` only
  routes the final surfaces;
- every remaining Markdown file under `docs/` has varied, specific `summary`
  and `read_when` frontmatter;
- link validation passes for local Markdown links;
- a third-party review pass checks substantive docs for stale claims, lost
  context, overlap, verbosity, and inaccurate routing.

This is a rewrite, not a patch over the previous docs. Prefer the final
information architecture even when old docs used a different category name.

## Surfaces

| Section | Purpose | Do not include |
| --- | --- | --- |
| `product/` | User-facing behavior and product contracts. | Source tours, test names, implementation history. |
| `internals/` | System ownership, boundaries, data flow, invariants. | User-facing product copy, line-by-line file inventories. |
| `reference/` | Exact formats, APIs, precedence, command maps, keyboard maps. | Narrative architecture or broad product explanation. |
| `operations/` | Human workflows: development, testing, performance, release. | Product specs or implementation rationale. |
| `decisions/` | Accepted tradeoffs and rejected alternatives. | Temporary plans, migration diaries, task checklists. |

If a doc crosses surfaces, split it. Link between pages instead of duplicating
content.

## Frontmatter

Every Markdown file in the final `docs/` tree must have:

```yaml
---
summary: One specific sentence naming what this page owns.
read_when:
  - changing the behavior, workflow, or boundary this page owns
  - debugging a failure that depends on the page's contract
---
```

`summary` should name the durable subject and the kind of information inside.
Avoid vague summaries such as "Documents the vector editor."

Good:

```yaml
summary: Explains vector point editing, path topology, compound containers, and when Paper-backed overlays may write back to engine state.
```

`read_when` should be varied and concrete. Use verbs and nouns that match real
work. Avoid repeating one sentence shape across files.

Good:

```yaml
read_when:
  - changing pen hover, point insertion, endpoint closing, or vector writeback
  - debugging stale vector chrome after path, compound, resize, or import changes
  - deciding whether path logic belongs in the engine or the Paper overlay
```

Bad:

```yaml
read_when:
  - changing vector editing
  - working on vector editing
```

During the docs overhaul, old files may still show `[missing front matter]` in
`bun run docs:list`. Treat that as remaining migration work, not an exception to
the final rule.

## Brevity

Prefer short pages that state contracts directly.

- Use tables for precedence, ownership, and command maps.
- Use bullets for invariants and intentionally missing behavior.
- Cut filler like "it is important to note", "currently", "should generally",
  and "as part of the system".
- Prefer present tense: "The engine owns selection" over "The engine should
  own selection."
- Do not list tests unless the test layer is itself the topic.
- Do not list every source file. Name the owning module or subsystem when that
  is enough.

## Product Pages

Product pages describe what users can do and what behavior must mean.

Use this shape when it fits:

```md
# Feature Name

One short paragraph with the product contract.

## In The Product

- **Capability.** Concrete behavior users can rely on.

## Rules

- Stable behavior, ordering, ownership, and edge cases.

## Intentionally Missing

- Non-goals that prevent accidental scope creep.

## Related

- Links to internals, reference, decisions, or operations.
```

Product pages may mention implementation only to prevent a bad coding decision.

## Internals Pages

Internals pages describe system boundaries that code must preserve.

Include:

- owning modules or packages
- source of truth for state
- data flow between systems
- durable invariants
- what must not cross the boundary

Avoid code listings unless the exact shape is the contract. Link to reference
for exact APIs and formats.

## Reference Pages

Reference pages are lookup surfaces.

Use tables, schemas, and short examples. Include exact names, precedence order,
payload shapes, keyboard shortcuts, command ids, and validation rules.

Do not explain broad product motivation here.

## Operations Pages

Operations pages tell a maintainer what to run and how to recover.

Include:

- prerequisites
- commands
- expected artifacts or outputs
- failure modes
- cleanup or rollback guidance

Keep commands current with `package.json` and scripts.

## Decisions

Decision pages record durable tradeoffs.

Use this shape:

```md
# Decision Title

Status: Accepted
Date: YYYY-MM-DD

## Context

Why this decision exists.

## Decision

The rule we follow.

## Consequences

What this makes easier, harder, or forbidden.
```

Superseded decisions stay only when the supersession itself is useful history.
Otherwise migrate the durable rule into the active decision and delete the old
page.

## Migration Rules

Do not delete an old doc until its durable content is accounted for.

Each old paragraph should become one of:

- product contract
- internals invariant
- reference contract
- operations step
- decision context or consequence
- discarded stale plan

Retire planning docs by extracting the active rule and dropping the diary.
Retire specs by folding product behavior into `product/`.
Retire architecture docs by splitting exact contracts into `reference/` and
ownership boundaries into `internals/`.
