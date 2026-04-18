import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";
import { buildEntryContextBundle, buildEntryReviewBundle } from "./context.js";
import { buildGraphData, buildRegistryData, buildStatusData } from "./export.js";
import { buildRegistry } from "./registry.js";
import type { Registry, RegistryEntry } from "./registry.js";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function renderSection(title: string, content: string): string {
  return `<section><h2>${escapeHtml(title)}</h2>${md.render(content || "_TODO_")}</section>`;
}

function entryOutputName(id: string): string {
  return `${id}.html`.replaceAll("/", "_").replaceAll(":", "_");
}

function basePage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/assets/site.css" />
  </head>
  <body>
    <main class="page">
      ${body}
    </main>
  </body>
</html>`;
}

function renderEntryPage(entry: RegistryEntry): string {
  const fm = entry.document.frontMatter;
  const sectionOrder = [
    "Informal statement",
    "Assumptions",
    "Conclusion",
    "Proof outline",
    "Key dependencies",
    "Formalization notes",
    "Open gaps",
  ];
  const sections = sectionOrder
    .map((section) => renderSection(section, entry.document.sections[section] ?? ""))
    .join("\n");

  const metadata = `
    <header>
      <h1>${escapeHtml(fm.title)}</h1>
      <p><strong>${escapeHtml(fm.kind)}</strong> · status: <strong>${escapeHtml(entry.computedStatus)}</strong></p>
      <p>id: <code>${escapeHtml(fm.id)}</code></p>
      <p>cluster: <code>${escapeHtml(fm.cluster)}</code></p>
      <p>blocked_by: ${
        entry.blockedBy.length > 0
          ? entry.blockedBy.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")
          : "<em>none</em>"
      }</p>
    </header>
  `;

  return basePage(fm.title, `${metadata}\n${sections}`);
}

function renderOverviewPage(registry: Registry): string {
  const fm = registry.overview.frontMatter;
  const introSections = Object.entries(registry.overview.sections)
    .map(([title, content]) => renderSection(title, content))
    .join("\n");
  const entryList = registry.entries
    .map(
      (entry) =>
        `<li><a href="/entries/${escapeHtml(entryOutputName(entry.document.frontMatter.id))}">${escapeHtml(
          entry.document.frontMatter.title,
        )}</a> <span class="status">${escapeHtml(entry.computedStatus)}</span></li>`,
    )
    .join("\n");

  const summary = `
    <header>
      <h1>${escapeHtml(fm.title)}</h1>
      ${fm.subtitle ? `<p>${escapeHtml(fm.subtitle)}</p>` : ""}
      <p>project id: <code>${escapeHtml(fm.project_id)}</code></p>
      <p>status: <strong>${escapeHtml(fm.status)}</strong></p>
      <p><a href="/graph.html">Open dependency graph</a></p>
    </header>
    <section>
      <h2>Entries</h2>
      <ul>${entryList}</ul>
    </section>
  `;

  return basePage(fm.title, `${summary}\n${introSections}`);
}

function renderGraphPage(registry: Registry): string {
  const graph = buildGraphData(registry);
  const nodeItems = graph.nodes
    .map(
      (node) =>
        `<li><code>${escapeHtml(node.id)}</code> · ${escapeHtml(node.kind)} · ${escapeHtml(node.status)}</li>`,
    )
    .join("\n");
  const edgeItems = graph.edges
    .map(
      (edge) =>
        `<li><code>${escapeHtml(edge.from)}</code> → <code>${escapeHtml(edge.to)}</code> (${escapeHtml(
          edge.source,
        )})</li>`,
    )
    .join("\n");

  return basePage(
    `${registry.overview.frontMatter.title} Graph`,
    `
      <header>
        <h1>Dependency Graph</h1>
        <p><a href="/index.html">Back to overview</a></p>
        <p>JSON data: <code>/generated/dep-graph.json</code></p>
      </header>
      <section>
        <h2>Nodes</h2>
        <ul>${nodeItems}</ul>
      </section>
      <section>
        <h2>Edges</h2>
        <ul>${edgeItems}</ul>
      </section>
    `,
  );
}

const SITE_CSS = `
body { font-family: sans-serif; margin: 0; background: #fcfcf7; color: #1f1f1a; }
.page { max-width: 960px; margin: 0 auto; padding: 2rem; }
h1, h2 { line-height: 1.15; }
code { background: #f0efe8; padding: 0.1rem 0.3rem; border-radius: 4px; }
.status { margin-left: 0.5rem; color: #666; }
section { margin-top: 2rem; }
`;

export async function buildSite(rootDir: string, outDir: string): Promise<Registry> {
  const registry = await buildRegistry(rootDir);
  const entriesDir = path.join(outDir, "entries");
  const assetsDir = path.join(outDir, "assets");
  const generatedDir = path.join(outDir, "generated");
  const contextDir = path.join(generatedDir, "entry-context");
  const reviewDir = path.join(generatedDir, "entry-review");

  await mkdir(entriesDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });
  await mkdir(generatedDir, { recursive: true });
  await mkdir(contextDir, { recursive: true });
  await mkdir(reviewDir, { recursive: true });

  await writeFile(path.join(outDir, "index.html"), renderOverviewPage(registry), "utf-8");
  await writeFile(path.join(outDir, "graph.html"), renderGraphPage(registry), "utf-8");
  await writeFile(path.join(assetsDir, "site.css"), SITE_CSS, "utf-8");

  const graphData = buildGraphData(registry);
  for (const entry of registry.entries) {
    const fileName = entryOutputName(entry.document.frontMatter.id);
    await writeFile(path.join(entriesDir, fileName), renderEntryPage(entry), "utf-8");
    const jsonFile = `${fileName.replace(/\.html$/, "")}.json`;
    await writeFile(
      path.join(contextDir, jsonFile),
      JSON.stringify(buildEntryContextBundle(registry, entry.document.frontMatter.id), null, 2),
      "utf-8",
    );
    await writeFile(
      path.join(reviewDir, jsonFile),
      JSON.stringify(buildEntryReviewBundle(registry, entry.document.frontMatter.id), null, 2),
      "utf-8",
    );
  }

  await writeFile(
    path.join(generatedDir, "registry.json"),
    JSON.stringify(buildRegistryData(registry), null, 2),
    "utf-8",
  );
  await writeFile(
    path.join(generatedDir, "status.json"),
    JSON.stringify(buildStatusData(registry), null, 2),
    "utf-8",
  );
  await writeFile(
    path.join(generatedDir, "dep-graph.json"),
    JSON.stringify(graphData, null, 2),
    "utf-8",
  );

  return registry;
}
