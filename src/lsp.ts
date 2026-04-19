import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./lean.js";

export interface FormalDependencyOverrides {
  [entryId: string]: string[];
}

export type FormalDependencyProviderName = "override" | "lean-lsp-mcp";

export interface FormalDependencyProvider {
  name: FormalDependencyProviderName;
  implemented: boolean;
  load(rootDir: string): Promise<FormalDependencyOverrides>;
}

export interface LeanmdConfig {
  formal_dependency_provider?: FormalDependencyProviderName;
}

export async function loadFormalDependencyOverrides(rootDir: string): Promise<FormalDependencyOverrides> {
  const overridePath = path.join(rootDir, ".leanmd", "formal-deps.json");
  if (!(await fileExists(overridePath))) {
    return {};
  }

  const content = await readFile(overridePath, "utf-8");
  const data = JSON.parse(content) as unknown;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("formal-deps.json must contain an object mapping entry ids to string arrays.");
  }

  const result: FormalDependencyOverrides = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new Error(`formal-deps.json entry '${key}' must be an array of strings.`);
    }
    result[key] = value;
  }

  return result;
}

export async function loadLeanmdConfig(rootDir: string): Promise<LeanmdConfig> {
  const configPath = path.join(rootDir, ".leanmd", "config.json");
  if (!(await fileExists(configPath))) {
    return {};
  }

  const content = await readFile(configPath, "utf-8");
  const data = JSON.parse(content) as unknown;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("config.json must contain an object.");
  }

  const config = data as Record<string, unknown>;
  const provider = config.formal_dependency_provider;
  if (provider !== undefined && provider !== "override" && provider !== "lean-lsp-mcp") {
    throw new Error("formal_dependency_provider must be 'override' or 'lean-lsp-mcp'.");
  }

  return {
    formal_dependency_provider: provider as FormalDependencyProviderName | undefined,
  };
}

export function restrictFormalDependenciesToKnownIds(
  overrides: FormalDependencyOverrides,
  knownIds: Iterable<string>,
): FormalDependencyOverrides {
  const known = new Set(knownIds);
  const filtered: FormalDependencyOverrides = {};

  for (const [entryId, deps] of Object.entries(overrides)) {
    filtered[entryId] = deps.filter((dep) => known.has(dep));
  }

  return filtered;
}

export const overrideFormalDependencyProvider: FormalDependencyProvider = {
  name: "override",
  implemented: true,
  load: loadFormalDependencyOverrides,
};

export const leanLspMcpFormalDependencyProvider: FormalDependencyProvider = {
  name: "lean-lsp-mcp",
  implemented: false,
  async load(_rootDir: string): Promise<FormalDependencyOverrides> {
    return {};
  },
};

export async function resolveFormalDependencyProvider(rootDir: string): Promise<FormalDependencyProvider> {
  const config = await loadLeanmdConfig(rootDir);
  if (config.formal_dependency_provider === "lean-lsp-mcp") {
    return leanLspMcpFormalDependencyProvider;
  }
  return overrideFormalDependencyProvider;
}
