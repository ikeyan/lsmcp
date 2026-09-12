import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { applyWorkspaceEditManually } from "./workspace.ts";
import { nodeFileSystemApi } from "../utils/filesystem.ts";

describe("applyWorkspaceEditManually", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
  });

  it("applies edits to a file whose path needs URI escaping", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lsmcp ws #"));
    dirs.push(dir);
    const file = join(dir, "a.ts");
    writeFileSync(file, "let unused = 1;\nexport {};\n");
    const uri = pathToFileURL(file).toString();
    expect(uri).toContain("%20");

    await applyWorkspaceEditManually(
      {
        changes: {
          [uri]: [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 1, character: 0 },
              },
              newText: "",
            },
          ],
        },
      },
      nodeFileSystemApi,
    );

    expect(readFileSync(file, "utf-8")).toBe("export {};\n");
  });
});
