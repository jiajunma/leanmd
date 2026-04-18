# leanmdblueprint Project Plan

## 1. Project Goal

`leanmdblueprint` is not a Markdown rewrite of `leanblueprint`.

It is intended to be an AI-native operating layer for Lean formalization projects:

- organize theorem-level mathematical narratives
- connect each narrative entry to a Lean declaration
- provide blueprint-style project structure
- provide doc-gen-style code browsing
- make it easy for AI to review whether natural language and Lean are aligned

The tool should treat Lean projects as a collection of machine-checkable theorem packets, not as a PDF-first book.

## 2. Problems With Existing Tools

### `leanblueprint`

- LaTeX-centered workflow is slow for iteration.
- Natural language and Lean declarations are too weakly coupled.
- `checkdecls` can verify declaration names exist, but not true alignment between prose and formal statements.
- The project model is document-first rather than AI-first.
- Despite these issues, `leanblueprint` already solves several valuable project-organization problems and should be treated as the main starting point rather than discarded.

### `doc-gen4`

- It is useful for declaration browsing, source links, and API pages.
- It is not suitable as the main data model for theorem-level project management.
- It tends toward library-wide documentation, which brings in too much imported material.
- For this project, we do not want a local mirror of all Mathlib declarations.
- We only want theorem-relevant context and actually-used external dependencies.

## 3. Core Design Principles

- Markdown-first, not LaTeX-first.
- Lean and prose should be near each other in the repository.
- Theorem entry is the main object, not chapter and not module.
- Lean is the formal anchor.
- Markdown is the human-facing narrative layer.
- A structured registry is the machine-checkable source of alignment.
- AI should work theorem-by-theorem on small typed context bundles.
- The main output is a fast static documentation site, not a PDF.
- Build up on `leanblueprint` wherever its existing abstractions are already correct.
- AI workflows should be captured as reusable skills instead of being left as ad hoc prompting.
- Heavy validation should run through a narrow MCP-style server boundary to keep agent context clean.

## 3A. Relationship To `leanblueprint`

The current strategic direction is to build on top of `leanblueprint`, not replace it from scratch.

That means:

- preserve the parts of `leanblueprint` that already work well for mathematical project organization
- reuse implementation pieces when this saves time and keeps behavior stable
- replace the parts that are tightly coupled to LaTeX or too weak for AI alignment

In practical terms, this project should be thought of as:

- `leanblueprint` upgraded to be Markdown-first
- `leanblueprint` upgraded to expose a stronger machine-readable registry
- `leanblueprint` upgraded to support AI-native review workflows
- `leanblueprint` upgraded to coexist with declaration browsing in the style of `doc-gen`

## 4. Main Object Model

The central unit is an `Entry`.

An `Entry` represents one mathematical object such as:

- theorem
- lemma
- definition
- proposition
- corollary

Each entry should have a stable `id` and bind:

- one primary Lean declaration
- one primary Markdown narrative page
- zero or more helper declarations
- structured metadata for project management

Suggested schema:

```yaml
id: thm:sylow_exists
kind: theorem
lean: MyProject.GroupTheory.sylow_exists
md: GroupTheory/Sylow/exists.md
status: formalized
alignment_status: clean
```

Suggested logical fields:

- `id`
- `kind`
- `lean_name`
- `formal_statement`
- `informal_statement`
- `assumptions`
- `conclusion`
- `proof_outline`
- `semantic_deps`
- `external_deps`
- `status`
- `open_gaps`
- `alignment_status`
- `source_location`

Important rule:

- `status` is not authoritatively declared by Markdown.
- completion status must be derived from Lean-side facts whenever possible.
- Markdown may describe intent or progress notes, but not override Lean-confirmed state.
- in particular, `formalized` should mean `sorry-free` on the Lean side.

## 5. File Organization

The current preferred direction is:

- one Lean file for formal code
- one nearby Markdown file for theorem-level narrative
- Lean comments only for local technical notes

Example:

```text
GroupTheory/
  Sylow/
    exists.lean
    exists.md
    conjugacy.lean
    conjugacy.md
```

Why this layout:

- Lean tooling stays clean.
- Markdown editing stays pleasant.
- AI can easily map files by path and id.
- Drift detection is easier.

We explicitly do **not** want to put the entire natural-language proof into Lean comments.

Lean comments should only contain local details such as:

- implementation-specific proof notes
- non-obvious rewrites
- local TODOs
- explanation of a technical trick

## 6. Markdown Page Shape

Markdown must be structured enough for AI checking.

Preferred front matter:

```yaml
---
id: thm:sylow_exists
lean: MyProject.GroupTheory.sylow_exists
kind: theorem
uses:
  - def:p_group
  - lem:orbit_stabilizer
---
```

Preferred fixed sections:

```md
# Informal statement

# Assumptions

# Conclusion

# Proof outline

# Key dependencies

# Formalization notes

# Open gaps
```

Rationale:

- AI can compare field-to-field instead of prose-to-proof wholesale.
- Missing sections become machine-detectable.
- Statement drift is easier to catch.
- Dependencies can be reviewed locally.
- authoritative completion state stays on the Lean side instead of drifting in prose.

## 7. Lean-Side Responsibilities

Lean should not only provide source code. It should export structured data.

The Lean-side exporter should provide:

- declaration name
- kind
- pretty-printed type
- source location
- local declarations used
- external declarations used
- tags/status if present
- optional theorem-level metadata hooks

Important distinction:

- `structural deps`: noisy kernel-level or elaboration-level dependencies
- `semantic deps`: declarations a human would cite in the proof story
- `narrative deps`: dependencies that should appear in the Markdown page

The tool should focus on `semantic deps` and `narrative deps`, not dump raw dependency noise into the UI.

Lean-side export should also determine project status signals such as:

- declaration exists or does not exist
- theorem is fully formalized
- declaration is still a placeholder
- declaration is admitted / sorry-based / incomplete
- theorem depends on incomplete upstream results

Current intended status semantics:

- `formalized`: declaration exists and is `sorry-free`
- `incomplete`: declaration exists but still contains `sorry` or another incomplete marker
- `missing`: expected entry exists in the project plan but no corresponding Lean declaration is found
- `blocked`: declaration exists but depends on incomplete upstream results

## 8. Alignment Layer

This is a first-class feature, not an afterthought.

The tool should support two kinds of checks.

### Rule checks

- `id` exists and is unique
- Markdown file exists
- Lean declaration exists
- Markdown and Lean bind consistently
- required sections exist
- dependency references resolve
- no orphan objects

### Semantic alignment checks

- informal statement omits a Lean hypothesis
- informal statement strengthens the conclusion
- informal statement weakens the conclusion
- notation mismatch
- proof outline mentions a lemma not reflected in dependencies
- status mismatch between narrative and formal code

The output should be machine-readable and theorem-local.

Proof-completion status must be Lean-confirmed.

That means:

- if a theorem still contains `sorry` or another incomplete marker, it is not complete
- if a theorem depends on incomplete results, that should be visible in status
- Markdown may not mark an entry as completed against Lean evidence
- the default completion criterion for MVP is `sorry-free`

## 9. AI-Native Workflow

The tool should not ask AI to read an entire project or all of Mathlib.

Instead it should generate a theorem-level review bundle containing:

- formal statement
- informal statement
- assumptions
- conclusion
- proof outline
- semantic dependencies
- selected external dependencies
- notation table
- open gaps

This bundle should power AI tasks such as:

- check statement alignment
- check proof-outline drift
- draft informal statement from Lean theorem type
- suggest formalization TODOs from the Markdown page
- summarize a theorem and its dependencies

The system should also track staleness:

- Lean file changed -> corresponding Markdown entry becomes `needs-review`
- Markdown file changed -> alignment status becomes stale

## 9A. Skills Layer

The project should include a dedicated skills layer for recurring AI workflows.

The goal of the skills layer is:

- keep prompts short and consistent
- keep theorem-local review workflows reusable
- avoid re-explaining alignment procedures in every session
- reduce context bloat by moving stable process knowledge out of ad hoc chat

Candidate built-in skills:

- `align-review`: compare one theorem entry against its Lean declaration
- `statement-draft`: draft an informal statement from a Lean theorem type
- `outline-check`: compare proof outline against semantic dependencies
- `gap-audit`: inspect open gaps and suggest next formalization tasks
- `context-pack`: prepare a theorem-local bundle for downstream AI tools

Skills should prefer structured inputs and outputs over free-form prose.

For example, a skill should consume:

- entry id
- formal statement
- assumptions
- conclusion
- proof outline
- dependency summary

and emit:

- a verdict
- issue list
- confidence level
- suggested edits or follow-up tasks

## 9B. MCP Validation Layer

Validation should be exposed through an MCP-style server boundary where practical.

The motivation is:

- keep the main AI context window focused on theorem-local reasoning
- move deterministic or semi-deterministic checks out of chat context
- allow external tools to request validation without re-embedding the whole project
- standardize machine-readable validation outputs

The MCP layer should be responsible for narrow, explicit operations such as:

- fetch entry packet by id
- fetch theorem-local dependency closure
- run structural alignment checks
- query Lean-confirmed proof status
- run theorem-level review pipelines
- return cached validation results

Preferred property:

- the agent asks the MCP server for a compact theorem packet or validation report
- the server performs project scanning, dependency slicing, and low-level checks
- the agent only receives the minimal payload needed for reasoning

## 10. Integrating Blueprint and Doc-Gen Functionality

The new tool should include both categories of functionality, but on top of one unified registry.

### Blueprint-style features to keep

- theorem/definition/proposition pages
- project structure by mathematical entries
- dependency graph
- status tracking
- open gaps / not-ready items
- human-readable proof outlines

### Doc-gen-style features to keep

- declaration pages
- source links
- type display
- name search
- declaration cross-links
- navigation from theorem entry to source declaration

### Features not to inherit directly

- LaTeX-first pipeline
- full imported-library documentation explosion
- treating module hierarchy as the primary product structure
- weak declaration-name-only checks as the main validation method

### Code reuse policy

The default policy is to reuse and extend `leanblueprint` unless there is a clear architectural reason not to.

Good reuse candidates:

- dependency-graph ideas and implementation pieces
- project status concepts
- declaration-to-entry linking logic
- existing entry models and page-generation logic
- any already-working project bookkeeping that is not LaTeX-bound

Bad reuse candidates:

- LaTeX-centered build pipeline
- assumptions that document compilation is the core workflow
- weak coupling models where prose and Lean can drift silently
- code paths whose structure makes Markdown-first or AI-native workflows harder to add

## 11. Build and Rendering

The recommended main rendering stack is a lightweight static site generator, not LaTeX.

Current preference:

- first choice: `VitePress`
- second choice: `mdBook`

Reasons to prefer a lighter static site tool:

- fast incremental development
- Markdown-native
- easy metadata handling via front matter
- easy integration with generated JSON registries
- easier to add custom theorem cards, dependency panels, and source widgets

LaTeX/PDF should only be optional export later, not the main workflow.

Proposed main pipeline:

1. `lake exe leanmd export`
2. `leanmd sync`
3. `leanmd check`
4. `vitepress dev`

## 11A. Math and Diagram Support

Mathematical notation is a hard requirement, not an optional enhancement.

The tool must support:

- inline math
- display math
- theorem-heavy notation
- project-level math macros
- numbered equations when needed
- reliable rendering for symbols commonly used in Lean-adjacent mathematics

### Math rendering direction

The site layer should treat math rendering as a first-class concern.

Current implementation direction:

- integrate a TeX-to-HTML math renderer into the Markdown pipeline
- keep project-specific macros in one shared configuration
- ensure math rendering is deterministic in local development and CI

Current renderer preference:

- first choice for speed: `KaTeX`
- keep room for `MathJax` fallback if macro compatibility becomes a blocker

Why this should remain configurable:

- `KaTeX` is fast and well-suited for static sites
- some projects may need broader TeX compatibility than `KaTeX` provides
- theorem-heavy math writing often accumulates custom macros over time

### TikZ support direction

TikZ support is also a real requirement.

However, TikZ should **not** be treated as the main document compiler.

Preferred strategy:

- author TikZ in fenced code blocks or dedicated asset files
- compile TikZ at build time to SVG
- embed the generated SVG into the site
- cache compiled outputs aggressively

Preferred build-time path:

- use a lightweight TeX engine such as `Tectonic` for standalone compilation
- convert outputs to SVG using `dvisvgm` or an equivalent SVG-friendly path

Rationale:

- SVG is easy to embed in a fast static site
- build-time compilation is more reproducible than browser-only TikZ execution
- caching can make repeated builds fast
- the site stays lightweight for readers

Browser-side TikZ rendering may be useful as an optional preview feature, but it should not be the primary production path.

### Diagram support beyond TikZ

The system should also leave room for:

- plain SVG assets
- Mermaid or graph visualizations where appropriate
- generated dependency graphs for theorem entries

But TikZ remains important because many mathematical authors already use it.

## 12. Main Modules

The current architecture should have at least these modules.

### 1. Registry

Responsible for:

- theorem-entry registry
- id mapping
- Lean <-> Markdown binding
- dependency metadata
- proof-status metadata derived from Lean

### 2. Lean Exporter

Responsible for:

- extracting declarations
- extracting statements
- extracting source locations
- extracting relevant dependencies
- extracting completion status from Lean code
- detecting incomplete declarations or incomplete dependency chains

### 3. Markdown Sync

Responsible for:

- parsing front matter
- checking required sections
- linking entries to Lean declarations
- detecting orphan pages or missing pages

### 4. Alignment Checker

Responsible for:

- structural checks
- semantic drift checks
- theorem-local reports
- AI review bundle generation

### 5. Site Layer

Responsible for:

- project dashboard
- theorem entry pages
- declaration pages
- dependency graph views
- status views
- math rendering
- embedded diagram rendering

Dependency graph should be a first-class UI surface, not an afterthought.

The graph should support:

- entry-to-entry dependencies
- entry-to-declaration links where useful
- filtering local vs external dependencies
- showing incomplete upstream blockers
- showing which entries are fully Lean-confirmed

Implementation note:

- if `leanblueprint` already has a working dependency-graph pipeline, the project should adapt that pipeline before considering a rewrite

### 6. Context Slicer

Responsible for:

- selecting theorem-local context for AI
- keeping external dependencies small
- producing compact review bundles

### 7. Skills Package

Responsible for:

- codifying recurring AI workflows
- defining structured review prompts
- defining stable output schemas for AI-assisted checks
- reducing repeated context setup in interactive sessions

### 8. MCP Validation Server

Responsible for:

- exposing theorem packets to AI tools
- running deterministic validation checks
- serving cached dependency slices
- reporting Lean-confirmed completion state
- keeping expensive project scans outside the main interaction context

## 13. CLI Surface

The tool should eventually expose a small, focused CLI.

Suggested commands:

```text
leanmd export
leanmd sync
leanmd check
leanmd review thm:foo
leanmd context thm:foo
leanmd status
leanmd mcp
```

Command meanings:

- `export`: export Lean-side registry data
- `sync`: match Lean objects with Markdown pages
- `check`: run structural and optional semantic checks
- `review`: build a theorem-local AI review bundle
- `context`: print or save minimal theorem context
- `status`: show project-wide progress and drift
- `mcp`: run the validation/context server for external AI tooling

## 14. MVP Scope

The first version should stay narrow.

### Must-have MVP features

- theorem-level registry
- nearby `.lean + .md` pairing
- fixed Markdown template
- Lean exporter
- structural checker
- theorem-level context bundler
- minimal AI alignment reviewer
- project status summary
- strong math rendering
- build-time TikZ-to-SVG support
- dependency graph
- Lean-confirmed completion status
- initial skills for alignment and context preparation
- MCP-style validation/context server

Additional MVP implementation principle:

- prefer adapting existing `leanblueprint` functionality over rewriting mature features from zero

### Explicit non-goals for MVP

- full Mathlib documentation mirror
- PDF-first output
- complete natural-language proof equivalence checking
- heavy visual polish
- large-scale collaboration features

## 15. Longer-Term Extensions

Possible second-stage features:

- richer dependency graph visualization
- PR and CI integration
- stale-review invalidation tracking
- automatic informal statement drafting
- automatic TODO extraction from open gaps
- richer theorem dashboards
- optional PDF export
- declaration-to-entry reverse navigation improvements

## 16. Open Design Questions

These questions are not fully settled yet.

### Semantic dependency extraction

- How should semantic dependencies be computed?
- Can we derive them automatically, or must authors curate them?
- How much proof-term analysis is worth doing in MVP?

### Completion-status policy

- What exact Lean-side signals define `formalized`, `incomplete`, and `blocked`?
- How should incomplete upstream dependencies affect downstream status?
- Should status distinguish "the theorem exists but the narrative is stale" from "the theorem is not yet proved"?

Current MVP answer:

- `formalized` means `sorry-free`
- `incomplete` means not `sorry-free`
- `blocked` is derived from incomplete dependencies
- alignment staleness is tracked separately from proof completion

### Metadata placement

- Which metadata belongs in Lean?
- Which metadata belongs in Markdown?
- Should some metadata be generated instead of hand-authored?

### Entry granularity

- Is the right unit always one entry per theorem, or do some projects need one entry per section or proof cluster?
- How should one Markdown page relate to multiple helper declarations?
- How should one Lean file with many small lemmas map back to entry pages?

### Schema and versioning

- How should exported JSON schemas be versioned?
- How should old entry records be migrated when fields change?
- Which fields are mandatory in MVP and which can be added lazily?

### Caching and incrementality

- What exactly invalidates an exported theorem packet?
- What exactly invalidates an AI review result?
- Should caching happen at file level, declaration level, or entry level?
- How should TikZ build cache and theorem-packet cache interact?

### Skills boundary

- Which AI workflows deserve first-class skills in MVP?
- Which workflows should remain plain CLI features?
- How should skill outputs be versioned if schemas evolve?

### MCP boundary

- Which validations belong in the MCP server versus the main CLI?
- Should the MCP server wrap the CLI or share a lower-level library?
- How should caching and invalidation work for theorem packets and reports?

### Lean integration boundary

- Should the Lean exporter work through custom attributes, docstrings, environment extensions, or pure declaration scanning?
- How much information can be extracted reliably from Lean alone without extra author annotations?
- Which parts of status and dependency analysis should happen inside Lean versus outside Lean?

### UI shape

- How much of doc browsing should be embedded into theorem pages?
- Should declaration pages be first-class pages or side panels?

### Navigation model

- Should users navigate primarily by theorem graph, file tree, or search?
- How should reverse links from declarations back to theorem entries be surfaced?
- How should external Mathlib dependencies appear without overwhelming the local project view?

### Math rendering policy

- Is `KaTeX` compatibility sufficient for the intended mathematical notation?
- Which project-level macros should be centrally configured?
- Do we need equation numbering in MVP or can it wait?

### TikZ workflow

- Should TikZ live inline in Markdown or in separate asset files?
- What cache key should determine whether a TikZ figure needs recompilation?
- How should TikZ compilation failures be surfaced in CI and local development?

### AI review policy

- Which checks are deterministic?
- Which checks should be AI-assisted only?
- How should AI review reports be stored and invalidated?

### Testing and evaluation

- What example projects should serve as the benchmark corpus?
- How do we measure whether alignment checks are actually useful instead of noisy?
- What regression suite should protect schema, exporter, and site behavior?

### Migration and adoption

- How should an existing `leanblueprint` project migrate into this format?
- Can a project adopt the tool gradually, or does it require a big-bang conversion?
- What is the minimum amount of Markdown structure required before the tool becomes useful?

### Deployment and environment

- Which external tools are hard dependencies in MVP?
- How should the tool behave when `Tectonic`, `dvisvgm`, or optional AI tooling is missing?
- What should CI require versus what may remain optional in local development?

## 17. Working Summary

The current plan is to build:

- a theorem-first
- Markdown-first
- Lean-anchored
- AI-native
- non-LaTeX
- project-management and documentation system
- with first-class dependency graph support
- with proof completion confirmed from Lean rather than prose
- with reusable AI skills for theorem-local work
- with an MCP-style validation layer to keep context clean

It should unify:

- blueprint-style mathematical project structure
- doc-gen-style declaration browsing
- theorem-local AI alignment review

without inheriting:

- LaTeX-first workflows
- whole-library documentation bloat
- weak prose/code coupling

## 18. Immediate Next Steps

When implementation starts, the next concrete steps should be:

1. audit `leanblueprint` and identify which modules should be reused directly
2. define the exact JSON schema for exported entry records
3. define the exact Markdown front matter and required sections
4. define the Lean exporter interface
5. define the alignment report schema
6. define the skill interfaces and output schemas
7. define the MCP server operations and payload schemas
8. scaffold the CLI
9. pick and wire the site generator
