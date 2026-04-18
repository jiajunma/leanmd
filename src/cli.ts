#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { parseEntryDocument, parseOverviewDocument } from "./markdown.js";

async function main(): Promise<void> {
  const [, , command, target] = process.argv;

  if (!command || !target) {
    console.error("Usage: leanmd <entry|overview> <path>");
    process.exitCode = 1;
    return;
  }

  const content = await readFile(target, "utf-8");

  if (command === "entry") {
    const parsed = parseEntryDocument(target, content);
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  if (command === "overview") {
    const parsed = parseOverviewDocument(target, content);
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  console.error(`Unknown command '${command}'.`);
  process.exitCode = 1;
}

void main();
