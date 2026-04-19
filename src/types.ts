export type EntryKind = "theorem" | "definition" | "lemma" | "proposition";

export type EntryStatus = "missing" | "incomplete" | "blocked" | "formalized";

export interface LeanBinding {
  main_file?: string;
  main_decl?: string;
}

export interface DependsOn {
  informal: string[];
  formal: string[];
}

export interface EntryFrontMatter {
  id: string;
  kind: EntryKind;
  title: string;
  cluster: string;
  status: EntryStatus;
  depends_on: DependsOn;
  used_by?: string[];
  blocked_by?: string[];
  lean?: LeanBinding;
}

export interface OverviewFrontMatter {
  project_id: string;
  kind: "overview";
  title: string;
  subtitle?: string;
  main_clusters?: string[];
  featured_entries?: string[];
  status: EntryStatus;
}

export interface MarkdownSections {
  [section: string]: string;
}

export interface ParsedEntryDocument {
  kind: "entry";
  path: string;
  frontMatter: EntryFrontMatter;
  sections: MarkdownSections;
  rawBody: string;
}

export interface ParsedOverviewDocument {
  kind: "overview";
  path: string;
  frontMatter: OverviewFrontMatter;
  sections: MarkdownSections;
  rawBody: string;
}

export interface BenchmarkProject {
  id: string;
  title: string;
  repository: string;
  published_blueprint: string;
  notes?: string;
}
