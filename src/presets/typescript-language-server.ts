import type { Preset } from "../config/schema.ts";

/**
 * TypeScript adapter (default)
 *
 * Follows the TypeScript the project has installed: TypeScript 7+ ships the
 * native (Go) compiler whose `tsc --lsp --stdio` is a language server (and
 * has no tsserver for typescript-language-server to drive), older versions
 * are served through typescript-language-server.
 */
export const typescriptAdapter: Preset = {
  presetId: "typescript",
  binFindStrategy: {
    strategies: [
      // 1. TypeScript 7+: the compiler itself serves LSP (older tsc has no --lsp)
      {
        type: "node_modules",
        names: ["tsc"],
        args: ["--lsp", "--stdio"],
        requires: { package: "typescript", minMajor: 7 },
      },
      // 2. typescript-language-server from node_modules
      { type: "node_modules", names: ["typescript-language-server"] },
      // 3. Check global installation
      { type: "global", names: ["typescript-language-server"] },
      // 4. Fall back to npx
      { type: "npx", package: "typescript-language-server" },
    ],
    defaultArgs: ["--stdio"],
  },
  files: [
    "**/*.ts",
    "**/*.tsx",
    "**/*.d.ts",
    "**/*.js",
    "**/*.jsx",
    "**/*.mjs",
    "**/*.mts",
    "**/*.cjs",
  ],
  initializationOptions: {
    preferences: {
      includeCompletionsForModuleExports: true,
      includeCompletionsWithInsertText: true,
    },
  },
  serverCharacteristics: {
    documentOpenDelay: 2000,
    readinessCheckTimeout: 1000,
    initialDiagnosticsTimeout: 3000,
    requiresProjectInit: true,
    sendsInitialDiagnostics: true,
    operationTimeout: 15000,
  },

  // Language-specific features
  languageFeatures: {
    typescript: {
      enabled: true,
      indexNodeModules: true,
      maxFiles: 5000,
    },
  },

  // Unsupported features
  unsupported: [],
};
