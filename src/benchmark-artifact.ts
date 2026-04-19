import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeBenchmarkArtifact(
  benchmarkId: string,
  kind: string,
  data: unknown,
): Promise<string> {
  const reportsDir = path.join("benchmarks", "reports");
  await mkdir(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, `${benchmarkId}-${kind}.json`);
  await writeFile(outPath, JSON.stringify(data, null, 2), "utf-8");
  return outPath;
}
