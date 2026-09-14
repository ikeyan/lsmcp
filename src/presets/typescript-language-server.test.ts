import { describe, it, expect } from "vitest";
import { typescriptAdapter } from "./typescript-language-server.ts";

describe("typescriptAdapter", () => {
  it("prefers TypeScript 7's tsc --lsp, then typescript-language-server", () => {
    expect(typescriptAdapter.binFindStrategy?.strategies).toEqual([
      {
        type: "node_modules",
        names: ["tsc"],
        args: ["--lsp", "--stdio"],
        requires: { package: "typescript", minMajor: 7 },
      },
      { type: "node_modules", names: ["typescript-language-server"] },
      { type: "global", names: ["typescript-language-server"] },
      { type: "npx", package: "typescript-language-server" },
    ]);
    expect(typescriptAdapter.binFindStrategy?.defaultArgs).toEqual(["--stdio"]);
  });
});
