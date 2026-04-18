#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { migrateBlueprintFile, writeMigratedEntries } from "./blueprint.js";
import { parseEntryDocument, parseOverviewDocument } from "./markdown.js";
import { checkRegistry } from "./registry.js";

async function main(): Promise<void> {
  const [, , command, target, maybeOutDir] = process.argv;

  if (!command || !target) {
    console.error("Usage: leanmd <entry|overview|check|migrate-blueprint> <path> [out-dir]");
    process.exitCode = 1;
    return;
  }

  if (command === "entry") {
    const content = await readFile(target, "utf-8");
    const parsed = parseEntryDocument(target, content);
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  if (command === "overview") {
    const content = await readFile(target, "utf-8");
    const parsed = parseOverviewDocument(target, content);
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  if (command === "check") {
    const result = await checkRegistry(target);
    console.log(
      JSON.stringify(
        {
          overview: result.registry.overview.frontMatter,
          entries: result.registry.entries.map((entry) => ({
            id: entry.document.frontMatter.id,
            status: entry.computedStatus,
            used_by: entry.usedBy,
            blocked_by: entry.blockedBy,
          })),
          issues: result.issues,
        },
        null,
        2,
      ),
    );
    if (result.issues.some((issue) => issue.level === "error")) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "migrate-blueprint") {
    if (!maybeOutDir) {
      console.error("Usage: leanmd migrate-blueprint <tex-file> <out-dir>");
      process.exitCode = 1;
      return;
    }
    const entries = await migrateBlueprintFile(target);
    await writeMigratedEntries(maybeOutDir, entries);
    console.log(
      JSON.stringify(
        entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          status: entry.status,
          depends_on: entry.depends_on.informal,
        })),
        null,
        2,
      ),
    );
    return;
  }

  console.error(`Unknown command '${command}'.`);
  process.exitCode = 1;
}

void main();
