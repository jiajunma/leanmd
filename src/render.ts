import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";
import { buildEntryContextBundle, buildEntryReviewBundle } from "./context.js";
import { buildGraphData, buildRegistryData, buildSiteManifest, buildStatusData } from "./export.js";
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

function clusterOutputName(cluster: string): string {
  return `${cluster}.html`.replaceAll("/", "_").replaceAll(":", "_");
}

function basePage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/assets/site.css" />
    <script type="module" src="/assets/app.js"></script>
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
  const statusCounts = new Map<string, number>();
  for (const entry of registry.entries) {
    statusCounts.set(entry.computedStatus, (statusCounts.get(entry.computedStatus) ?? 0) + 1);
  }
  const entryList = registry.entries
    .map(
      (entry) =>
        `<li><a href="/entries/${escapeHtml(entryOutputName(entry.document.frontMatter.id))}">${escapeHtml(
          entry.document.frontMatter.title,
        )}</a> <span class="status">${escapeHtml(entry.computedStatus)}</span></li>`,
    )
    .join("\n");
  const clusterMap = new Map<string, RegistryEntry[]>();
  for (const entry of registry.entries) {
    const list = clusterMap.get(entry.document.frontMatter.cluster) ?? [];
    list.push(entry);
    clusterMap.set(entry.document.frontMatter.cluster, list);
  }
  const clusterList = [...clusterMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([cluster, entries]) =>
        `<li><a href="/clusters/${escapeHtml(clusterOutputName(cluster))}">${escapeHtml(cluster)}</a> (${entries.length})</li>`,
    )
    .join("\n");
  let benchmarkSummary = "";
  if (fm.project_id) {
    const summaryPath = path.join("benchmarks", "reports", `${fm.project_id}-summary.json`);
    benchmarkSummary = `<div id="benchmark-summary" data-summary-json="/generated/benchmark-summary.json"></div>`;
  }

  const summary = `
    <header>
      <h1>${escapeHtml(fm.title)}</h1>
      ${fm.subtitle ? `<p>${escapeHtml(fm.subtitle)}</p>` : ""}
      <p>project id: <code>${escapeHtml(fm.project_id)}</code></p>
      <p>status: <strong>${escapeHtml(fm.status)}</strong></p>
      <p><a href="/graph.html">Open dependency graph</a></p>
      <p><a href="/status.html">Open status summary</a></p>
    </header>
    <section>
      <h2>Entries</h2>
      <p>
        formalized: ${statusCounts.get("formalized") ?? 0},
        incomplete: ${statusCounts.get("incomplete") ?? 0},
        blocked: ${statusCounts.get("blocked") ?? 0},
        missing: ${statusCounts.get("missing") ?? 0}
      </p>
      <ul>${entryList}</ul>
    </section>
    <section>
      <h2>Clusters</h2>
      <ul>${clusterList}</ul>
    </section>
    ${benchmarkSummary}
  `;

  return basePage(fm.title, `${summary}\n${introSections}`);
}

function renderGraphPage(registry: Registry): string {
  return basePage(
    `${registry.overview.frontMatter.title} Graph`,
    `
      <header>
        <h1>Dependency Graph</h1>
        <p><a href="/index.html">Back to overview</a></p>
        <p>JSON data: <code>/generated/dep-graph.json</code></p>
        <p>Solid edges = formal, dashed edges = informal.</p>
      </header>
      <section>
        <h2>SVG View</h2>
        <div id="graph-root" data-graph-json="/generated/dep-graph.json"></div>
      </section>
      <section>
        <h2>Nodes</h2>
        <div id="graph-summary"></div>
      </section>
    `,
  );
}

function renderStatusPage(registry: Registry): string {
  return basePage(
    `${registry.overview.frontMatter.title} Status`,
    `
      <header>
        <h1>Status Summary</h1>
        <p><a href="/index.html">Back to overview</a></p>
      </header>
      <div id="status-root" data-status-json="/generated/status.json" data-registry-json="/generated/registry.json"></div>
    `,
  );
}

function renderClusterPage(cluster: string, entries: RegistryEntry[]): string {
  const statusCounts = new Map<string, number>();
  for (const entry of entries) {
    statusCounts.set(entry.computedStatus, (statusCounts.get(entry.computedStatus) ?? 0) + 1);
  }

  const entryItems = entries
    .map(
      (entry) =>
        `<li><a href="/entries/${escapeHtml(entryOutputName(entry.document.frontMatter.id))}">${escapeHtml(
          entry.document.frontMatter.title,
        )}</a> <code>${escapeHtml(entry.document.frontMatter.id)}</code> <span class="status">${escapeHtml(
          entry.computedStatus,
        )}</span></li>`,
    )
    .join("\n");

  return basePage(
    `${cluster} Cluster`,
    `
      <header>
        <h1>Cluster: ${escapeHtml(cluster)}</h1>
        <p><a href="/index.html">Back to overview</a></p>
      </header>
      <section>
        <h2>Summary</h2>
        <p>
          formalized: ${statusCounts.get("formalized") ?? 0},
          incomplete: ${statusCounts.get("incomplete") ?? 0},
          blocked: ${statusCounts.get("blocked") ?? 0},
          missing: ${statusCounts.get("missing") ?? 0}
        </p>
      </section>
      <section>
        <h2>Entries</h2>
        <ul>${entryItems}</ul>
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
#graph-root svg { border: 1px solid #d8d3c7; background: #fffdf7; border-radius: 12px; }
`;

const SITE_APP_JS = `
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderGraph() {
  const root = document.getElementById("graph-root");
  if (!root) return;
  const summary = document.getElementById("graph-summary");
  const url = root.dataset.graphJson;
  if (!url) return;
  const response = await fetch(url);
  const graph = await response.json();
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const nodeSpacing = 96;
  const width = 900;
  const leftX = 120;
  const rectWidth = 220;
  const rectHeight = 44;
  const topY = 60;
  const svgHeight = Math.max(180, topY + nodes.length * nodeSpacing);
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const edgeSvg = edges.map((edge) => {
    const fromIndex = nodeIndex.get(edge.from) ?? 0;
    const toIndex = nodeIndex.get(edge.to) ?? 0;
    const fromY = topY + fromIndex * nodeSpacing + rectHeight / 2;
    const toY = topY + toIndex * nodeSpacing + rectHeight / 2;
    const strokeDash = edge.source === "informal" ? ' stroke-dasharray="6 4"' : "";
    return '<line x1="' + (leftX + rectWidth) + '" y1="' + fromY + '" x2="' + leftX + '" y2="' + toY + '" stroke="#8a8678" stroke-width="2"' + strokeDash + ' />';
  }).join("\\n");
  const nodeSvg = nodes.map((node, index) => {
    const y = topY + index * nodeSpacing;
    const fill =
      node.status === "formalized" ? "#d7f0d5" :
      node.status === "incomplete" ? "#f8d7d7" :
      node.status === "blocked" ? "#f6e9c7" : "#ececec";
    return '<g>' +
      '<rect x="' + leftX + '" y="' + y + '" width="' + rectWidth + '" height="' + rectHeight + '" rx="8" fill="' + fill + '" stroke="#5d5a50" />' +
      '<text x="' + (leftX + 12) + '" y="' + (y + 18) + '" font-size="12" font-family="sans-serif" fill="#444">' + escapeHtml(node.kind) + '</text>' +
      '<text x="' + (leftX + 12) + '" y="' + (y + 34) + '" font-size="14" font-family="sans-serif" fill="#111">' + escapeHtml(node.id) + '</text>' +
      '</g>';
  }).join("\\n");
  root.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + svgHeight + '" width="100%" height="' + svgHeight + '" role="img" aria-label="Dependency graph">' + edgeSvg + nodeSvg + '</svg>';
  if (summary) {
    const items = nodes.map((node) => '<li><code>' + escapeHtml(node.id) + '</code> · ' + escapeHtml(node.kind) + ' · ' + escapeHtml(node.status) + '</li>').join("");
    summary.innerHTML = '<ul>' + items + '</ul>';
  }
}

async function renderStatus() {
  const root = document.getElementById("status-root");
  if (!root) return;
  const statusUrl = root.dataset.statusJson;
  const registryUrl = root.dataset.registryJson;
  if (!statusUrl || !registryUrl) return;
  const [statusResponse, registryResponse] = await Promise.all([fetch(statusUrl), fetch(registryUrl)]);
  const statusRows = await statusResponse.json();
  const registryRows = await registryResponse.json();
  const titleById = new Map(registryRows.map((row) => [row.id, row.title]));
  const grouped = new Map();
  for (const row of statusRows) {
    const list = grouped.get(row.status) ?? [];
    list.push(row);
    grouped.set(row.status, list);
  }
  const ordered = ["formalized", "incomplete", "blocked", "missing"];
  root.innerHTML = ordered.map((status) => {
    const rows = grouped.get(status) ?? [];
    const items = rows.length > 0
      ? rows.map((row) => '<li><code>' + escapeHtml(row.id) + '</code> · ' + escapeHtml(titleById.get(row.id) ?? row.id) + '</li>').join("")
      : '<li><em>none</em></li>';
    return '<section><h2>' + escapeHtml(status) + '</h2><ul>' + items + '</ul></section>';
  }).join("");
}

async function renderBenchmarkSummary() {
  const root = document.getElementById("benchmark-summary");
  if (!root) return;
  const url = root.dataset.summaryJson;
  if (!url) return;
  const response = await fetch(url);
  if (!response.ok) return;
  const summary = await response.json();
  root.innerHTML =
    '<section><h2>Benchmark Summary</h2>' +
    '<p>our pipeline: <strong>' + (summary.timing_comparison.our_pipeline_ms ?? 'n/a') + ' ms</strong></p>' +
    '<p>leanblueprint web: <strong>' + (summary.timing_comparison.leanblueprint_web_ms ?? 'n/a') + ' ms</strong></p>' +
    '<p>speedup factor: <strong>' + (summary.timing_comparison.speedup_factor ?? 'n/a') + '</strong></p>' +
    '<p>entry count difference: <strong>' + summary.structure_comparison.entry_count_difference + '</strong></p>' +
    '<p>informal edge difference: <strong>' + summary.structure_comparison.informal_edge_count_difference + '</strong></p>' +
    '</section>';
}

Promise.allSettled([renderGraph(), renderStatus(), renderBenchmarkSummary()]).then((results) => {
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(result.reason);
    }
  }
});
`;

export async function buildSite(rootDir: string, outDir: string): Promise<Registry> {
  const registry = await buildRegistry(rootDir);
  const entriesDir = path.join(outDir, "entries");
  const clustersDir = path.join(outDir, "clusters");
  const assetsDir = path.join(outDir, "assets");
  const generatedDir = path.join(outDir, "generated");
  const contextDir = path.join(generatedDir, "entry-context");
  const reviewDir = path.join(generatedDir, "entry-review");

  await mkdir(entriesDir, { recursive: true });
  await mkdir(clustersDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });
  await mkdir(generatedDir, { recursive: true });
  await mkdir(contextDir, { recursive: true });
  await mkdir(reviewDir, { recursive: true });

  await writeFile(path.join(outDir, "index.html"), renderOverviewPage(registry), "utf-8");
  await writeFile(path.join(outDir, "graph.html"), renderGraphPage(registry), "utf-8");
  await writeFile(path.join(outDir, "status.html"), renderStatusPage(registry), "utf-8");
  await writeFile(path.join(assetsDir, "site.css"), SITE_CSS, "utf-8");
  await writeFile(path.join(assetsDir, "app.js"), SITE_APP_JS, "utf-8");

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

  const clusterMap = new Map<string, RegistryEntry[]>();
  for (const entry of registry.entries) {
    const list = clusterMap.get(entry.document.frontMatter.cluster) ?? [];
    list.push(entry);
    clusterMap.set(entry.document.frontMatter.cluster, list);
  }
  for (const [cluster, entries] of clusterMap.entries()) {
    await writeFile(
      path.join(clustersDir, clusterOutputName(cluster)),
      renderClusterPage(cluster, entries),
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
  await writeFile(
    path.join(generatedDir, "site-manifest.json"),
    JSON.stringify(buildSiteManifest(registry), null, 2),
    "utf-8",
  );

  const benchmarkSummaryPath = path.join("benchmarks", "reports", `${registry.overview.frontMatter.project_id}-summary.json`);
  try {
    const benchmarkSummary = await readFile(benchmarkSummaryPath, "utf-8");
    await writeFile(path.join(generatedDir, "benchmark-summary.json"), benchmarkSummary, "utf-8");
  } catch {
    // Missing benchmark summary is acceptable for non-benchmark projects.
  }

  return registry;
}
