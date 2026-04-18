import { parseDocument } from "yaml";

export interface ParsedFrontMatter {
  data: unknown;
  body: string;
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontMatter(content: string): ParsedFrontMatter {
  const match = content.match(FRONT_MATTER_RE);
  if (!match) {
    throw new Error("Missing YAML front matter.");
  }

  const [, yamlSource] = match;
  const doc = parseDocument(yamlSource);
  if (doc.errors.length > 0) {
    throw new Error(`Invalid YAML front matter: ${doc.errors[0]?.message ?? "unknown error"}`);
  }

  return {
    data: doc.toJS(),
    body: content.slice(match[0].length),
  };
}
