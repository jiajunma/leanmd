import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

export interface BlueprintBaselineReport {
  benchmark_id: string;
  tool: "leanblueprint";
  mode: "web";
  command: string[];
  cwd: string;
  exit_code: number;
  timings_ms: {
    total: number;
  };
  stdout_tail: string;
  stderr_tail: string;
}

function tail(text: string, maxChars = 4000): string {
  return text.length > maxChars ? text.slice(text.length - maxChars) : text;
}

export async function runLeanBlueprintWebBaseline(
  benchmarkId: string,
  blueprintDir: string,
  pythonExecutable: string,
): Promise<BlueprintBaselineReport> {
  const command = [pythonExecutable, "-m", "invoke", "web"];
  const start = performance.now();

  const result = await new Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(command[0]!, command.slice(1), {
      cwd: blueprintDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      });
    });
  });

  const end = performance.now();
  return {
    benchmark_id: benchmarkId,
    tool: "leanblueprint",
    mode: "web",
    command,
    cwd: blueprintDir,
    exit_code: result.exitCode,
    timings_ms: {
      total: end - start,
    },
    stdout_tail: tail(result.stdout),
    stderr_tail: tail(result.stderr),
  };
}
