import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";
import type { BenchmarkProject } from "./types.js";

function parseJsonLike<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const doc = parseDocument(content);
    if (doc.errors.length > 0) {
      throw new Error(`Invalid benchmark manifest: ${doc.errors[0]?.message ?? "unknown error"}`);
    }
    return doc.toJS() as T;
  }
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Expected non-empty string for benchmark field '${field}'.`);
  }
  return value;
}

export function parseBenchmarkProject(raw: unknown): BenchmarkProject {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Benchmark manifest must be a mapping.");
  }
  const data = raw as Record<string, unknown>;
  return {
    id: expectString(data.id, "id"),
    title: expectString(data.title, "title"),
    repository: expectString(data.repository, "repository"),
    published_blueprint: expectString(data.published_blueprint, "published_blueprint"),
    notes: typeof data.notes === "string" ? data.notes : undefined,
  };
}

export async function loadBenchmarkManifest(manifestPath: string): Promise<BenchmarkProject> {
  const content = await readFile(manifestPath, "utf-8");
  return parseBenchmarkProject(parseJsonLike<unknown>(content));
}

export async function loadBenchmarks(dir: string): Promise<BenchmarkProject[]> {
  const items = await readdir(dir, { withFileTypes: true });
  const manifests = items
    .filter((item) => item.isFile() && (item.name.endsWith(".json") || item.name.endsWith(".yaml") || item.name.endsWith(".yml")))
    .map((item) => path.join(dir, item.name))
    .sort();

  const benchmarks: BenchmarkProject[] = [];
  for (const manifest of manifests) {
    benchmarks.push(await loadBenchmarkManifest(manifest));
  }
  return benchmarks;
}

export async function loadBenchmarkById(dir: string, id: string): Promise<BenchmarkProject> {
  const benchmarks = await loadBenchmarks(dir);
  const benchmark = benchmarks.find((item) => item.id === id);
  if (!benchmark) {
    throw new Error(`Unknown benchmark '${id}'.`);
  }
  return benchmark;
}
