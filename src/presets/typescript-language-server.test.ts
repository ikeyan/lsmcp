import { describe, it, expect } from "vitest";
import { typescriptAdapter } from "./typescript-language-server.ts";

describe("typescriptAdapter", () => {
  it("uses tsc --lsp on TypeScript 7+, typescript-language-server otherwise", () => {
    expect(typescriptAdapter.binFindStrategy?.strategies).toEqual([
      {
        type: "node_modules",
        names: ["typescript-language-server"],
        override: {
          package: "typescript",
          minMajor: 7,
          names: ["tsc"],
          args: ["--lsp", "--stdio"],
        },
      },
      { type: "global", names: ["typescript-language-server"] },
      { type: "npx", package: "typescript-language-server" },
    ]);
    expect(typescriptAdapter.binFindStrategy?.defaultArgs).toEqual(["--stdio"]);
  });
});
