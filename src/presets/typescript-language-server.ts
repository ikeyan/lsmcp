import type { BinFindStrategyItem, Preset } from "../config/schema.ts";

const languageServer: BinFindStrategyItem[] = [
  { type: "node_modules", names: ["typescript-language-server"] },
  { type: "global", names: ["typescript-language-server"] },
  { type: "npx", package: "typescript-language-server" },
];

const tscLsp = (type: "node_modules" | "global") => ({
  type,
  names: ["tsc"],
  args: ["--lsp", "--stdio"],
});

/**
 * TypeScript adapter (default)
 */
export const typescriptAdapter: Preset = {
  presetId: "typescript",
  binFindStrategy: {
    strategies: [
      // The nearest tsc is the project's compiler: TypeScript 7+ serves LSP
      // from it, older ones are driven through typescript-language-server
      { ...tscLsp("node_modules"), ifFail: languageServer },
      { ...tscLsp("global"), ifFail: languageServer },
      ...languageServer,
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
