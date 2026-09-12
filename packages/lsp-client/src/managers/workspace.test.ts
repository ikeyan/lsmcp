import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { applyEditFromServer, applyWorkspaceEdit } from "./workspace.ts";
import { DocumentManager } from "./document-manager.ts";
import { nodeFileSystemApi } from "../utils/filesystem.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
});

function tempFile(name: string, content: string) {
  const dir = mkdtempSync(join(tmpdir(), "lsmcp ws #"));
  dirs.push(dir);
  const file = join(dir, name);
  writeFileSync(file, content);
  return { file, uri: pathToFileURL(file).toString() };
}

const deleteFirstLine = {
  range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
  newText: "",
};

describe("applyWorkspaceEdit", () => {
  it("applies edits to a file whose path needs URI escaping", async () => {
    const { file, uri } = tempFile("a.ts", "let unused = 1;\nexport {};\n");
    expect(uri).toContain("%20");

    const result = await applyWorkspaceEdit(
      { changes: { [uri]: [deleteFirstLine] } },
      nodeFileSystemApi,
    );

    expect(result).toEqual({ applied: true });
    expect(readFileSync(file, "utf-8")).toBe("export {};\n");
  });

  it("reports documentChanges as not applied instead of ignoring them", async () => {
    const result = await applyWorkspaceEdit(
      { documentChanges: [] } as never,
      nodeFileSystemApi,
    );

    expect(result).toEqual({
      applied: false,
      failureReason: "documentChanges is not supported",
    });
  });

  it("reports a failed write as not applied", async () => {
    const result = await applyWorkspaceEdit(
      { changes: { "file:///nonexistent/dir/a.ts": [deleteFirstLine] } },
      nodeFileSystemApi,
    );

    expect(result.applied).toBe(false);
    expect(result.failureReason).toMatch(/ENOENT/);
  });
});

describe("applyEditFromServer", () => {
  it("resends an open document's new content before returning", async () => {
    const { file, uri } = tempFile("a.ts", "let unused = 1;\nexport {};\n");
    const sent: Array<{ method: string; params: unknown }> = [];
    const send = (method: string, params: unknown) =>
      sent.push({ method, params });
    const documents = new DocumentManager();
    documents.openDocument(uri, readFileSync(file, "utf-8"), send);

    const result = await applyEditFromServer(
      { changes: { [uri]: [deleteFirstLine] } },
      nodeFileSystemApi,
      documents,
      send,
    );

    expect(result).toEqual({ applied: true });
    expect(sent.map((s) => s.method)).toEqual([
      "textDocument/didOpen",
      "textDocument/didChange",
    ]);
    expect(sent[1].params).toEqual({
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: "export {};\n" }],
    });
  });

  it("does not notify for documents that are not open", async () => {
    const { uri } = tempFile("a.ts", "let unused = 1;\nexport {};\n");
    const sent: string[] = [];

    await applyEditFromServer(
      { changes: { [uri]: [deleteFirstLine] } },
      nodeFileSystemApi,
      new DocumentManager(),
      (method) => sent.push(method),
    );

    expect(sent).toEqual([]);
  });
});
