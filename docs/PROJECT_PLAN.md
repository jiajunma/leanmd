# leanmdblueprint Project Plan

## 1. Project Goal

`leanmdblueprint` is not a Markdown rewrite of `leanblueprint`.

It is intended to be an AI-native operating layer for Lean formalization projects:

- organize entry-level mathematical narratives
- connect each entry to a Lean declaration when formalization exists
- provide blueprint-style project structure
- provide doc-gen-style code browsing
- make it easy for AI to review whether natural language and Lean are aligned
- act as a presentation system for the mathematical state of the project

The tool should treat Lean projects as a collection of machine-checkable entry packets, not as a PDF-first book.
It should be optimized for non-linear exploration rather than forcing a linear chapter-first reading order.

## 2. Problems With Existing Tools

### `leanblueprint`

- LaTeX-centered workflow is slow for iteration.
- Natural language and Lean declarations are too weakly coupled.
- `checkdecls` can verify declaration names exist, but not true alignment between prose and formal statements.
- The project model is document-first rather than AI-first.
- Despite these issues, `leanblueprint` already solves several valuable project-organization problems and should be treated as the main starting point rather than discarded.

### `doc-gen4`

- It is useful for declaration browsing, source links, and API pages.
- It is not suitable as the main data model for entry-level project management.
- It tends toward library-wide documentation, which brings in too much imported material.
- For this project, we do not want a local mirror of all Mathlib declarations.
- We only want theorem-relevant context and actually-used external dependencies.

## 3. Core Design Principles

- Markdown-first, not LaTeX-first.
- Lean and prose should be near each other in the repository.
- Entry is the main mathematical object, not chapter and not module.
- Lean is the formal anchor.
- Markdown is the human-facing narrative layer.
- A structured registry is the machine-checkable source of alignment.
- AI should work entry-by-entry on small typed context bundles.
- The main output is a fast static documentation site, not a PDF.
- Build up on `leanblueprint` wherever its existing abstractions are already correct.
- AI workflows should be captured as reusable skills instead of being left as ad hoc prompting.
- Heavy validation should run through a narrow MCP-style server boundary to keep agent context clean.
- the product should be a presentation system first, not a linear document compiler
- default navigation should be graph-oriented rather than chapter-oriented
- entry documents should be easy for coding agents to parse and rewrite
- entry-level checks should be designed to run in parallel by default

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
- `leanblueprint` upgraded from a linear blueprint view into a graph-driven presentation system

## 4. Main Object Model

The central unit is an `Entry`.

An `Entry` represents one mathematical object such as:

- a theorem
- a definition
- a proposition
- a lemma

Each entry should have a stable `id` and bind:

- one primary Lean declaration
- one primary Markdown narrative page
- zero or more nearby helper declarations in its local proof context
- structured metadata for project management

Markdown-page rule:

- each entry has exactly one primary Markdown page
- one Markdown page should not document multiple entries
- if the entry is a theorem, its page may include the theorem statement, proof outline, proof idea, and formalization notes
- the Markdown page is the human-facing narrative for that one entry
- the primary entry document should be a single `.md` file with a YAML front matter header

The project should also support a secondary organizational unit: `Cluster`.

A `Cluster` is:

- a small proof cluster
- a local neighborhood of related entries
- a place where several entries may share helper declarations or one proof story

Important distinction:

- `Entry` is the object that gets reviewed, displayed, and aligned
- `Cluster` is an organizational grouping for nearby entries and helper code
- ordinary lemmas are also entries, even if some views choose to visually de-emphasize them

Default node model:

- the main presentation graph should primarily emphasize two node kinds: definitions and theorems
- lemma entries may still exist in the registry, but they may be visually secondary or collapsed in the default graph

Agent-structure rule:

- every entry should have a YAML-structured representation
- coding-agent-facing workflows should rely on structured YAML fields rather than free-form prose parsing
- the YAML structure should live in the front matter of the entry's Markdown file
- Markdown remains the human presentation surface, but entry data should be recoverable from front matter without heuristic scraping

Suggested logical fields:

- `id`
- `kind`
- `title`
- `cluster`
- `status`
- `depends_on.informal`
- `depends_on.formal`
- `used_by` (optional)
- `blocked_by` (optional, autogenerated)
- `lean.main_file` (optional before formalization)
- `lean.main_decl` (optional before formalization)

Lean-binding rule:

- entries may exist before any Lean code has been written
- Lean-related fields should therefore be optional for pre-formalization entries
- once an entry moves into formalization, its Lean bindings should become populated and checkable

Current front-matter direction:

- keep entry front matter minimal and stable
- required core fields should include `id`, `kind`, `title`, `cluster`, `status`, and `depends_on`
- `used_by` should be present when available, but may be autogenerated and empty
- Lean-binding fields should live in an optional Lean-related block when formalization exists

Important rule:

- `status` is not authoritatively declared by Markdown.
- completion status must be derived from Lean-side facts whenever possible.
- Markdown may describe intent or progress notes, but not override Lean-confirmed state.
- in particular, `formalized` should mean `sorry-free` on the Lean side.
- the project should use one primary flat status field rather than multiple parallel business-status dimensions.
- alignment results may still be recorded, but they should remain review metadata rather than a second main status system.

Granularity rule:

- the default review unit is one theorem or one definition
- each entry has one main declaration as its anchor
- helper lemmas may be associated with an entry without becoming entries themselves
- multiple entries may belong to the same small proof cluster
- clusters exist to organize related entries, not to replace them

## 5. File Organization

The current preferred direction is:

- one ordinary Lean directory for a local topic area
- one main Lean file per entry inside that cluster
- one Markdown page per entry
- Lean comments only for local technical notes

Main-file rule:

- an entry's main Lean file should contain that entry's main declaration
- it may also contain only the local helper lemmas directly supporting that entry
- it should not mix in unrelated entries
- this keeps completion checks, dependency attribution, and AI review boundaries accurate

Example:

```text
GroupTheory/
  Sylow/
    helpers.lean
    thm_sylow_exists.lean
    sylow_exists.md
    thm_sylow_conjugacy.lean
    sylow_conjugacy.md
```

Why this layout:

- Lean tooling stays clean.
- Markdown editing stays pleasant.
- AI can easily map files by path and id.
- Drift detection is easier.
- related entries can share one local proof area without collapsing into one giant narrative page
- completion status can be checked cheaply from the entry's own Lean file
- each entry's completion status can be attributed cleanly because unrelated entries are kept out of its main Lean file
- each entry's narrative stays cleanly bound to one Markdown page
- cluster membership can stay as metadata instead of forcing another directory layer

We explicitly do **not** want to put the entire natural-language proof into Lean comments.

Lean comments should only contain local details such as:

- implementation-specific proof notes
- non-obvious rewrites
- local TODOs
- explanation of a technical trick

## 5A. Presentation Layers

The project should present mathematics through three layers plus one overview layer.

### 1. Overview / Introduction layer

This layer explains:

- the global logic of the project
- the high-level strategy
- how the main definitions and theorems fit together
- why the project is organized the way it is

This layer is closer to the introduction and roadmap of a paper.

### 2. Literary / idea layer

This layer records:

- motivations
- problem statements
- high-level ideas
- proof strategy sketches

This is the most human-facing conceptual layer.

### 3. Natural-language proof layer

This layer records:

- statements
- proof outlines
- proof explanations
- key dependencies in human mathematical terms

This layer may be AI-generated or AI-assisted, with human review and alignment.

### 4. Lean proof layer

This layer contains:

- Lean declarations
- local helper lemmas
- formally checked proof code

This is the programming / verification layer.

Important presentation rule:

- the system should make all four layers navigable from the same entry or cluster context
- the overview layer should not be hidden behind the same template as ordinary entry pages
- the overview / introduction layer should be the main entry point for the whole project presentation

Overview-file rule:

- project skeleton and introduction should live in one overview Markdown file
- that overview file should use the same general pattern: YAML front matter plus Markdown body
- the project should not require separate `project.yaml` and `overview.md` files

## 6. Markdown Page Shape

Markdown must be structured enough for AI checking.
Entry data should be YAML-friendly for coding-agent workflows.

Page-binding rule:

- each Markdown page corresponds to exactly one entry
- a theorem page may include proof content for that theorem
- proof explanations for different entries should not be merged into one page

Authoring-role rule:

- humans are not expected to hand-write every proof detail
- humans mainly contribute problems, ideas, directions, and high-level strategies
- AI is expected to generate most natural-language proof text and Lean proof drafts
- the system's responsibility is to align these layers and reflect real project status accurately

YAML-first rule:

- entry metadata should live in explicit YAML fields
- these YAML fields should normally live in the front matter of the entry's Markdown file
- if richer structured entry packets are needed, YAML should still be preferred over ad hoc custom text formats
- longer prose sections may stay in Markdown, but the machine-critical skeleton should be YAML-structured

Current entry front-matter draft:

```yaml
---
id: thm:sylow_exists
kind: theorem
title: Sylow existence
cluster: sylow
status: incomplete
depends_on:
  informal:
    - def:p_group
    - thm:orbit_stabilizer
  formal: []
used_by: []
lean:
  main_file: GroupTheory/Sylow/thm_sylow_exists.lean
  main_decl: MyProject.GroupTheory.sylow_exists
---
```

Field intent:

- `id`: stable entry identifier
- `kind`: one of theorem / definition / lemma / proposition
- `title`: human-facing title
- `cluster`: lightweight cluster name
- `status`: flat project status
- `depends_on.informal`: human-facing key dependencies
- `depends_on.formal`: machine-generated formal dependencies
- `used_by`: optional reverse dependencies
- `blocked_by`: autogenerated list of incomplete formal direct dependencies
- `lean`: optional block, present when Lean formalization exists

Current naming direction:

- prefer `cluster` over `cluster_id` in front matter for brevity
- prefer `lean.main_file` and `lean.main_decl` for clarity
- keep Lean binding nested under `lean` so pre-formalization entries can omit the whole block cleanly
- keep `cluster` as front-matter metadata rather than a required filesystem layer

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

Required-section rule:

- `Key dependencies` is a required section for every entry page
- it may be temporarily sparse, but it must be present
- this section is the primary home for informal dependencies in the Markdown layer
- a sparse or empty `Key dependencies` section should produce a warning rather than a hard error

Current overview front-matter draft:

The project entry point should also be one Markdown file with YAML front matter.

```yaml
---
project_id: my-project
kind: overview
title: My Project
subtitle: Formalization of ...
main_clusters:
  - sylow
  - burnside
featured_entries:
  - def:p_group
  - thm:sylow_exists
status: incomplete
---
```

Overview body responsibilities:

- explain the global logic of the project
- explain the main roadmap
- summarize major definitions and theorems
- summarize current progress and blockers
- summarize current progress and blocked-by relationships
- serve as the default landing page before users move into the graph or entry pages

Informal-dependency scope rule:

- `Key dependencies` should primarily list this project's own entries
- external library theorems should normally not be listed as informal dependencies
- an external theorem may be listed only when it is a major theorem that is genuinely part of the human mathematical story
- ordinary library lemmas should stay out of the main informal dependency list

Rationale:

- AI can compare field-to-field instead of prose-to-proof wholesale.
- Missing sections become machine-detectable.
- Statement drift is easier to catch.
- Dependencies can be reviewed locally.
- authoritative completion state stays on the Lean side instead of drifting in prose.
- each theorem or definition still gets its own narrative page and identity
- at minimum, outgoing dependencies are visible at the entry level

## 7. Lean-Side Responsibilities

Lean should not only provide source code. It should export structured data.

Current integration direction:

- declaration scanning provides the stable baseline inventory
- Lean-LSP analysis provides richer local semantic information when available
- the MVP should combine declaration scanning and Lean-LSP analysis instead of relying on only one mechanism

The Lean-side exporter should provide:

- declaration name
- kind
- pretty-printed type
- source location
- cluster membership
- local declarations used
- external declarations used
- tags/status if present
- optional entry-level metadata hooks

Lean-LSP-backed analysis should be used for tasks such as:

- finding declaration ranges and local references
- extracting more precise dependency slices
- relating helper lemmas to the main declaration through usage patterns
- improving entry-local context selection for AI review

Important distinction:

- `structural deps`: noisy kernel-level or elaboration-level dependencies
- `semantic deps`: declarations a human would cite in the proof story
- `informal deps`: dependencies that should appear in the Markdown page

The tool should focus on `semantic deps` and `informal deps`, not dump raw dependency noise into the UI.

Current dependency model:

- each entry may expose an informal dependency list
- each entry may also expose a formal dependency list discovered from Lean analysis
- these two lists serve different purposes and should not be collapsed prematurely

Working interpretation:

- `informal deps` are the dependencies the author wants to explain in natural language
- `formal deps` are the dependencies Lean-LSP can discover from the formal code
- mismatch between the two can be useful review information

Maintenance rule:

- formal dependencies are generated automatically from Lean-side analysis
- they are not intended to be hand-maintained in Markdown
- informal dependencies remain the author-facing dependency layer
- if an informal dependency has no matching formal dependency edge, that should be surfaced as a review warning rather than an immediate hard error
- if a formal dependency appears important but is absent from the informal dependency list, that should also be surfaced as a review warning
- dependency mismatches should not fail MVP builds by default

Dependency direction rule:

- each entry should expose the entries it depends on
- this may include both informal dependencies and formal dependencies
- `used_by` is optional but desirable when it can be computed cheaply and accurately
- reverse dependency navigation is allowed and recommended when available
- the MVP hard requirement is outgoing dependency information

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

Status note:

- keep the primary status model flat and simple
- do not introduce separate proof/prose/alignment status machines as first-class business states in MVP
- for MVP, completion can be determined by checking the entry's associated Lean source file(s) for `sorry`
- this is a source-text check, not a deeper proof analysis pass
- to keep this check meaningful, each entry should have a clear associated main Lean file
- `blocked` remains a valid flat primary status
- for MVP, `blocked` should be computed from this project's formal direct dependencies, not from informal dependencies and not from transitive closure
- when an entry is `blocked`, the specific upstream entries should be reported via `blocked_by`

## 8. Alignment Layer

This is a first-class feature, not an afterthought.

Parallelism rule:

- entry-level structural checks should be independent tasks whenever possible
- entry-level semantic review bundles should also be producible independently
- the checking pipeline should therefore be designed around per-entry jobs that can run in parallel
- shared project-wide passes should be kept small and clearly separated from per-entry work

The tool should support two kinds of checks.

### Rule checks

- `id` exists and is unique
- Markdown file exists
- Lean declaration exists
- Markdown and Lean bind consistently
- required sections exist
- dependency references resolve
- no orphan objects

Hard-error rule for MVP:

- duplicate ids are hard errors
- missing main Markdown pages are hard errors
- missing main Lean files or bindings are hard errors only for entries that claim Lean formalization
- nonexistent bound declarations are hard errors only when a Lean binding is present
- missing required sections are hard errors

### Semantic alignment checks

- informal statement omits a Lean hypothesis
- informal statement strengthens the conclusion
- informal statement weakens the conclusion
- notation mismatch
- proof outline mentions a lemma not reflected in dependencies
- status mismatch between informal and formal code

The output should be machine-readable and entry-local.

Warning rule for MVP:

- dependency mismatches between informal and formal views are warnings
- sparse `Key dependencies` sections are warnings
- alignment warnings should not fail builds by default in MVP

Proof-completion status must be Lean-confirmed.

That means:

- if the entry's associated Lean source still contains `sorry`, it is not complete
- if a theorem depends on incomplete results, that should be visible in status
- Markdown may not mark an entry as completed against Lean evidence
- the default completion criterion for MVP is a source-text `sorry` check on the entry's Lean file(s)
- implementation should avoid obvious false positives from comments or string literals

## 9. AI-Native Workflow

The tool should not ask AI to read an entire project or all of Mathlib.

Instead it should generate an entry-level review bundle containing:

- formal statement
- informal statement
- assumptions
- conclusion
- proof outline
- helper declarations
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
- draft natural-language proof text from the idea layer and Lean-side information

The system should also track staleness:

- Lean file changed -> corresponding Markdown entry becomes `needs-review`
- Markdown file changed -> alignment status becomes stale

## 9A. Skills Layer

The project should include a dedicated skills layer for recurring AI workflows.

The goal of the skills layer is:

- keep prompts short and consistent
- keep entry-local review workflows reusable
- avoid re-explaining alignment procedures in every session
- reduce context bloat by moving stable process knowledge out of ad hoc chat

Candidate built-in skills:

- `align-review`: compare one entry against its main Lean declaration and helper layer
- `statement-draft`: draft an informal statement from a Lean theorem type
- `outline-check`: compare proof outline against semantic dependencies
- `gap-audit`: inspect open gaps and suggest next formalization tasks
- `context-pack`: prepare an entry-local bundle for downstream AI tools

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

- keep the main AI context window focused on entry-local reasoning
- move deterministic or semi-deterministic checks out of chat context
- allow external tools to request validation without re-embedding the whole project
- standardize machine-readable validation outputs

The MCP layer should be responsible for narrow, explicit operations such as:

- fetch entry packet by id
- fetch entry-local dependency closure
- run structural alignment checks
- query Lean-confirmed proof status
- run entry-level review pipelines
- provide dependency-graph data
- return cached validation results

Preferred property:

- the agent asks the MCP server for a compact entry packet or validation report
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
- a project-level overview / introduction view

### Doc-gen-style features to keep

- declaration pages
- source links
- type display
- name search
- declaration cross-links
- navigation from entry pages to source declarations

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

The rendering stack should be a standalone static-site generator, not LaTeX and not a documentation-site framework.

Chosen implementation direction:

- main implementation language: `TypeScript`
- output model: static HTML, CSS, JS, and JSON assets
- site architecture: standalone generator owned by this project
- dependency policy: allow small focused libraries, avoid site frameworks

Why this direction:

- it preserves full control over the data model
- it matches the graph-first presentation goal better than a book/doc framework
- it keeps the generator aligned with agent-friendly YAML/Markdown inputs
- it still allows fast iteration without locking the project into a framework

Chosen small-library direction:

- YAML parsing: small YAML library
- Markdown parsing: `markdown-it` class of library
- math rendering: `KaTeX`
- graph rendering: project-owned SVG/HTML rendering with minimal helper code

LaTeX/PDF should only be optional export later, not the main workflow.

Proposed main pipeline:

1. `leanmd export`
2. `leanmd sync`
3. `leanmd check`
4. `leanmd build`

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
- generated dependency graphs for project entries

But TikZ remains important because many mathematical authors already use it.

## 12. Main Modules

The current architecture should have at least these modules.

### 1. Registry

Responsible for:

- entry registry
- cluster registry
- id mapping
- Lean <-> Markdown binding
- dependency metadata
- proof-status metadata derived from Lean

Dependency metadata should be able to distinguish:

- informal dependencies
- formal dependencies
- optional reverse dependencies

### 2. Lean Exporter

Responsible for:

- extracting declarations
- extracting statements
- extracting source locations
- extracting relevant dependencies
- extracting completion status from Lean code
- detecting incomplete declarations or incomplete dependency chains

For MVP, completion-status extraction may be implemented as a source scan over the entry's associated Lean file(s).

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
- entry-local reports
- AI review bundle generation

### 5. Site Layer

Responsible for:

- project dashboard
- overview / introduction pages
- entry pages
- declaration pages
- dependency graph views
- status views
- math rendering
- embedded diagram rendering

The site layer should be generated by the standalone generator rather than delegated to an external site framework.

Dependency graph should be a first-class UI surface, not an afterthought.

The graph should support:

- entry-to-entry dependencies
- entry-to-declaration links where useful
- filtering local vs external dependencies
- switching between informal and formal dependency views when both are available
- showing incomplete upstream blockers
- showing which entries are fully Lean-confirmed

Graph edge-style rule:

- dashed edges represent informal dependencies from the human-facing informal description
- solid edges represent formal dependencies discovered from Lean analysis
- when both relations exist between the same two entries, the graph should make that visible rather than silently collapsing them

Graph scope rule:

- the default dependency graph should show only this project's own entries
- external library objects such as Mathlib declarations should not become default graph nodes
- external dependencies may still appear as metadata or details, but they should not dominate the main project graph

Graph simplification rule:

- lemma entries still exist in the registry and dependency model
- the main dependency graph may hide or de-emphasize lemma nodes by default to reduce clutter
- when lemma nodes are hidden, their contribution may still be reflected by arrows or collapsed paths

Cluster-metadata rule:

- MVP does not require a separate cluster metadata file
- cluster identity should come from entry front matter
- richer cluster metadata can be added later if needed

Default navigation rule:

- the primary navigation surface should be a DAG-style dependency graph
- linear reading order should be available as a secondary convenience, not the main organizing principle

Entry pages should also show:

- direct dependencies
- informal dependencies and formal dependencies as distinct views when both are available
- `blocked_by` when the entry is blocked
- reverse dependencies when available
- which downstream entries are affected by this entry when reverse data is available

Cluster and project overviews should also show:

- a high-level introduction
- the logical roadmap of the project
- the major definition/theorem nodes
- current progress and blocked-by information

Project-entry rule:

- the default landing page of the project should be the overview / introduction layer
- from that landing page, users should be able to move into the graph, then into entries, then into Lean details

Default presentation rule:

- entry pages should foreground informal dependencies first
- formal dependencies should still be available, but as a secondary machine-derived view
- if the UI offers a single default dependency lens, it should default to the informal one

Default graph rule:

- the graph may display both informal and formal edges together
- if the UI offers a single default graph lens, it should default to the informal dependency view

Implementation note:

- if `leanblueprint` already has a working dependency-graph pipeline, the project should adapt that pipeline before considering a rewrite

### 6. Context Slicer

Responsible for:

- selecting entry-local context for AI
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

- exposing entry packets to AI tools
- running deterministic validation checks
- serving cached dependency slices
- reporting Lean-confirmed completion state
- keeping expensive project scans outside the main interaction context
- scheduling or serving entry-level checks in parallel where appropriate

## 13. CLI Surface

The tool should eventually expose a small, focused CLI.

Suggested commands:

```text
leanmd export
leanmd sync
leanmd check
leanmd review entry:foo
leanmd context entry:foo
leanmd status
leanmd build
leanmd mcp
```

Command meanings:

- `export`: export Lean-side registry data
- `sync`: match Lean objects with Markdown pages
- `check`: run structural and optional semantic checks
- `review`: build an entry-local AI review bundle
- `context`: print or save minimal entry context
- `status`: show project-wide progress and drift
- `build`: generate the standalone static site output
- `mcp`: run the validation/context server for external AI tooling

Current intended MCP operations:

- `get_entry`
- `get_entry_context`
- `get_proof_status`
- `check_alignment`
- `get_dep_graph`

## 14. MVP Scope

The first version should stay narrow.

### Must-have MVP features

- entry-level registry
- nearby `.lean + .md` pairing
- fixed Markdown template
- Lean exporter
- structural checker
- entry-level context bundler
- minimal AI alignment reviewer
- project status summary
- strong math rendering
- build-time TikZ-to-SVG support
- dependency graph
- Lean-confirmed completion status
- initial skills for alignment and context preparation
- MCP-style validation/context server
- overview / introduction layer
- graph-first navigation

Additional MVP implementation principle:

- prefer adapting existing `leanblueprint` functionality over rewriting mature features from zero

Chosen MVP defaults:

- ordinary lemmas are entries
- `blocked` remains a flat primary status
- completion uses source-aware `sorry` checking
- informal dependencies live in Markdown
- formal dependencies are autogenerated
- dependency mismatches are warnings
- local project entries dominate the main dependency graph
- `TypeScript` is the main implementation language
- the site is generated by a standalone generator, not a framework
- `KaTeX` is the default math renderer
- TikZ is compiled to SVG at build time
- the product is a graph-driven presentation system
- the overview entry point is one Markdown file with YAML front matter
- `blocked` is computed from formal direct dependencies only
- cluster metadata stays lightweight in MVP
- entry-level checks should be parallelizable in the implementation

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

## 16. Resolved Details

### Semantic dependency policy

- `depends_on.informal` is the human-facing dependency list authored in Markdown and reviewed by AI/humans
- `depends_on.formal` is autogenerated from Lean-LSP analysis
- mismatches between the two are warnings, not hard errors

### Completion-status policy

- `formalized` means the entry's associated Lean file(s) contain no active `sorry`
- `incomplete` means the entry's associated Lean file(s) still contain active `sorry`
- `missing` means Lean formalization for the entry is absent
- `blocked` means at least one formal direct dependency is `missing` or `incomplete`
- `blocked_by` lists those incomplete formal direct dependencies
- alignment staleness is review metadata, not a primary business status

### Metadata placement

- machine-critical metadata lives in YAML front matter
- human-facing exposition lives in Markdown body sections
- Lean binding fields are optional until formalization exists
- formal dependencies, `used_by`, and `blocked_by` are generated rather than hand-maintained

### Entry granularity

- one entry corresponds to one theorem, definition, proposition, or lemma
- multiple entries may share a local topic directory and helper file
- each entry should have one main Lean file when formalization exists
- that main Lean file should contain only the entry's main declaration and directly related local helpers

### Schema and versioning

- the generator should emit versioned JSON artifacts
- schema versioning should be explicit in generated files from the first implementation
- MVP fields should stay minimal and stable; additive extension is preferred

### Caching and incrementality

- caching and scheduling should be entry-oriented wherever practical
- entry-level checks and page generation should parallelize cleanly
- project-wide passes should be limited to indexing, reverse-linking, and graph aggregation

### Skills boundary

- code handles deterministic parsing, checking, status, dependency aggregation, and rendering
- AI handles semantic drafting, informal proof text, dependency suggestions, and semantic review
- humans provide problems, ideas, direction, and final approval/alignment

### MCP boundary

- MCP should expose entry packets, entry contexts, proof status, alignment checks, and graph data
- MCP should serve deterministic facts and cached payloads, not replace the generator
- the main CLI and MCP server should share the same lower-level data model

### Lean integration boundary

- declaration scanning determines local inventory and file binding
- Lean-LSP provides ranges, references, local context, and formal dependency discovery
- source-aware `sorry` scanning determines completion status
- formal dependency discovery comes from Lean-side analysis, while informal dependency lists come from Markdown

### UI shape and navigation

- primary navigation is graph-first
- overview pages are the project entry point
- entry pages foreground informal dependencies
- declaration pages remain secondary drill-down views rather than the main organizing layer

### Math and diagram policy

- use `KaTeX` by default for math rendering
- compile TikZ to SVG at build time
- keep project-level math macros centrally configured

### AI review policy

- deterministic checks remain in code
- AI-assisted checks are advisory and warning-oriented in MVP
- AI review outputs should be stored as generated review artifacts, not as the primary source of truth

### Testing and evaluation

- validate the generator on representative blueprint-style projects
- maintain regression tests for front matter parsing, status computation, dependency generation, and output rendering
- benchmark usefulness of review warnings on real migrated examples

### Migration and adoption

- adoption should be gradual, not big-bang
- projects may start with idea-only entries before Lean formalization exists
- migration from `leanblueprint` should preserve labels, declared Lean bindings, uses-relationships, and prose structure where possible

### Deployment and environment

- required external tooling should be minimal and explicit
- missing optional tooling should degrade gracefully where possible
- TikZ compilation support may be optional in local development but should be testable in CI

## 17. Remaining Non-Blocking Tuning

- exact cache keys and invalidation boundaries
- benchmark corpus selection
- optional richer cluster metadata
- optional search and declaration-page depth
- final CSS/JS asset organization

## 17. Working Summary

The current plan is to build:

- an entry-first
- Markdown-first
- Lean-anchored
- AI-native
- non-LaTeX
- project-management and documentation system
- with first-class dependency graph support
- with proof completion confirmed from Lean rather than prose
- with reusable AI skills for entry-local work
- with an MCP-style validation layer to keep context clean
- with Lean-LSP as the primary semantic analysis layer alongside declaration scanning

It should unify:

- blueprint-style mathematical project structure
- doc-gen-style declaration browsing
- entry-local AI alignment review

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
8. scaffold the standalone TypeScript generator and CLI
9. wire the HTML/CSS/JS output pipeline
