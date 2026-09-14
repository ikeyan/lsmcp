import { describe, it, expect } from "vitest";
import type { ChildProcess } from "child_process";
import { ConnectionHandler } from "./connection.ts";
import { createInitialState, type LSPProcessState } from "./state.ts";

/** A state whose process records everything the client writes to stdin. */
function createState() {
  const written: Array<Record<string, unknown>> = [];
  const process = {
    stdin: {
      write(chunk: string) {
        written.push(JSON.parse(chunk.slice(chunk.indexOf("\r\n\r\n") + 4)));
        return true;
      },
    },
  } as unknown as ChildProcess;
  const state = createInitialState({
    process,
    rootPath: "/project",
    languageId: "typescript",
  });
  return { state, written };
}

function deliver(state: LSPProcessState, message: Record<string, unknown>) {
  const body = JSON.stringify(message);
  state.buffer += `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

describe("ConnectionHandler server-to-client requests", () => {
  it("accepts a didChangeConfiguration registration", () => {
    // tsgo (tsc --lsp) sends this right after initialize and blocks on it;
    // the client never changes configuration, so the registration holds.
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: "ts1",
      method: "client/registerCapability",
      params: {
        registrations: [
          { id: "cfg", method: "workspace/didChangeConfiguration" },
        ],
      },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([{ jsonrpc: "2.0", id: "ts1", result: null }]);
  });

  it("rejects a registration it cannot honour instead of faking success", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: "ts2",
      method: "client/registerCapability",
      params: {
        registrations: [
          { id: "cfg", method: "workspace/didChangeConfiguration" },
          { id: "watch", method: "workspace/didChangeWatchedFiles" },
        ],
      },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([
      {
        jsonrpc: "2.0",
        id: "ts2",
        error: {
          code: -32602,
          message:
            "Cannot honour registration of: workspace/didChangeWatchedFiles",
        },
      },
    ]);
  });

  it("acknowledges window/workDoneProgress/create", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: 7,
      method: "window/workDoneProgress/create",
      params: { token: "t" },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([{ jsonrpc: "2.0", id: 7, result: null }]);
  });

  it("answers workspace/configuration with one entry per item", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: 3,
      method: "workspace/configuration",
      params: { items: [{ section: "typescript" }, { section: "deno" }] },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([
      {
        jsonrpc: "2.0",
        id: 3,
        result: [{}, { enable: true, lint: true, unstable: true }],
      },
    ]);
  });

  it("rejects unknown server requests instead of leaving them pending", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      id: 4,
      method: "window/showMessageRequest",
      params: { message: "?" },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([
      {
        jsonrpc: "2.0",
        id: 4,
        error: {
          code: -32601,
          message: "Method not found: window/showMessageRequest",
        },
      },
    ]);
  });

  it("does not answer notifications", () => {
    const { state, written } = createState();
    deliver(state, {
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri: "file:///project/a.ts", diagnostics: [] },
    });

    new ConnectionHandler(state).processBuffer();

    expect(written).toEqual([]);
    expect(state.diagnostics.get("file:///project/a.ts")).toEqual([]);
  });
});
