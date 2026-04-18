import { access, readFile } from "node:fs/promises";

function isIdentChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9_']/.test(ch);
}

export function countActiveSorry(content: string): number {
  let count = 0;
  let i = 0;
  let blockDepth = 0;
  let inLineComment = false;
  let inString = false;

  while (i < content.length) {
    const ch = content[i]!;
    const next = content[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
      }
      i += 1;
      continue;
    }

    if (blockDepth > 0) {
      if (ch === "/" && next === "-") {
        blockDepth += 1;
        i += 2;
        continue;
      }
      if (ch === "-" && next === "/") {
        blockDepth -= 1;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (inString) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === "-" && next === "-") {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === "/" && next === "-") {
      blockDepth = 1;
      i += 2;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      i += 1;
      continue;
    }

    if (content.startsWith("sorry", i)) {
      const before = content[i - 1];
      const after = content[i + 5];
      if (!isIdentChar(before) && !isIdentChar(after)) {
        count += 1;
        i += 5;
        continue;
      }
    }

    i += 1;
  }

  return count;
}

export async function countActiveSorryInFile(filePath: string): Promise<number> {
  const content = await readFile(filePath, "utf-8");
  return countActiveSorry(content);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
