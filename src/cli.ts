#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { parseEntryDocument, parseOverviewDocument } from "./markdown.js";
import { checkRegistry } from "./registry.js";

async function main(): Promise<void> {
  const [, , command, target] = process.argv;

  if (!command || !target) {
    console.error("Usage: leanmd <entry|overview|check> <path>");
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

  console.error(`Unknown command '${command}'.`);
  process.exitCode = 1;
}

void main();
