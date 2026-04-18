import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./lean.js";

export interface FormalDependencyOverrides {
  [entryId: string]: string[];
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
