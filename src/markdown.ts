import type {
  EntryFrontMatter,
  MarkdownSections,
  OverviewFrontMatter,
  ParsedEntryDocument,
  ParsedOverviewDocument,
} from "./types.js";
import { parseFrontMatter } from "./frontmatter.js";

const HEADING_RE = /^# (.+)$/gm;

function parseSections(body: string): MarkdownSections {
  const matches = [...body.matchAll(HEADING_RE)];
  const sections: MarkdownSections = {};

  if (matches.length === 0) {
    return sections;
  }

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const title = current[1].trim();
    const start = current.index! + current[0].length;
    const end = next ? next.index! : body.length;
    sections[title] = body.slice(start, end).trim();
  }

  return sections;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Expected non-empty string for '${field}'.`);
  }
  return value;
}

function expectStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Expected string array for '${field}'.`);
  }
  return value;
}

function parseEntryFrontMatter(raw: unknown): EntryFrontMatter {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Entry front matter must be a mapping.");
  }
  const data = raw as Record<string, unknown>;
  const dependsOn = data.depends_on as Record<string, unknown> | undefined;
  if (!dependsOn || typeof dependsOn !== "object") {
    throw new Error("Entry front matter requires 'depends_on'.");
  }

  const leanRaw = data.lean as Record<string, unknown> | undefined;
  let lean: EntryFrontMatter["lean"] | undefined;
  if (leanRaw && typeof leanRaw === "object") {
    const parsedLean: EntryFrontMatter["lean"] = {};
    if (leanRaw.main_file !== undefined) {
      parsedLean.main_file = expectString(leanRaw.main_file, "lean.main_file");
    }
    if (leanRaw.main_decl !== undefined) {
      parsedLean.main_decl = expectString(leanRaw.main_decl, "lean.main_decl");
    }
    if (parsedLean.main_file || parsedLean.main_decl) {
      lean = parsedLean;
    }
  }

  return {
    id: expectString(data.id, "id"),
    kind: expectString(data.kind, "kind") as EntryFrontMatter["kind"],
    title: expectString(data.title, "title"),
    cluster: expectString(data.cluster, "cluster"),
    status: expectString(data.status, "status") as EntryFrontMatter["status"],
    depends_on: {
      informal: expectStringArray(dependsOn.informal ?? [], "depends_on.informal"),
      formal: expectStringArray(dependsOn.formal ?? [], "depends_on.formal"),
    },
    used_by: data.used_by ? expectStringArray(data.used_by, "used_by") : [],
    blocked_by: data.blocked_by ? expectStringArray(data.blocked_by, "blocked_by") : [],
    lean,
  };
}

function parseOverviewFrontMatter(raw: unknown): OverviewFrontMatter {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Overview front matter must be a mapping.");
  }
  const data = raw as Record<string, unknown>;

  return {
    project_id: expectString(data.project_id, "project_id"),
    kind: expectString(data.kind, "kind") as "overview",
    title: expectString(data.title, "title"),
    subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
    main_clusters: data.main_clusters ? expectStringArray(data.main_clusters, "main_clusters") : [],
    featured_entries: data.featured_entries
      ? expectStringArray(data.featured_entries, "featured_entries")
      : [],
    status: expectString(data.status, "status") as OverviewFrontMatter["status"],
  };
}

export function parseEntryDocument(path: string, content: string): ParsedEntryDocument {
  const parsed = parseFrontMatter(content);
  return {
    kind: "entry",
    path,
    frontMatter: parseEntryFrontMatter(parsed.data),
    sections: parseSections(parsed.body),
    rawBody: parsed.body,
  };
}

export function parseOverviewDocument(path: string, content: string): ParsedOverviewDocument {
  const parsed = parseFrontMatter(content);
  return {
    kind: "overview",
    path,
    frontMatter: parseOverviewFrontMatter(parsed.data),
    sections: parseSections(parsed.body),
    rawBody: parsed.body,
  };
}
