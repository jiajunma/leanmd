import { stringify } from "yaml";
import type { ParsedEntryDocument } from "./types.js";

function serializeFrontMatter(frontMatter: ParsedEntryDocument["frontMatter"]): string {
  const ordered: Record<string, unknown> = {
    id: frontMatter.id,
    kind: frontMatter.kind,
    title: frontMatter.title,
    cluster: frontMatter.cluster,
    status: frontMatter.status,
    depends_on: {
      informal: frontMatter.depends_on.informal,
      formal: frontMatter.depends_on.formal,
    },
    used_by: frontMatter.used_by ?? [],
    blocked_by: frontMatter.blocked_by ?? [],
  };

  if (frontMatter.lean) {
    ordered.lean = {
      main_file: frontMatter.lean.main_file,
      main_decl: frontMatter.lean.main_decl,
    };
  }

  return `---\n${stringify(ordered).trimEnd()}\n---\n`;
}

export function serializeEntryDocument(document: ParsedEntryDocument): string {
  return `${serializeFrontMatter(document.frontMatter)}\n${document.rawBody.trimStart()}`;
}
