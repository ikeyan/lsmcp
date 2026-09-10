/**
 * Binary finder utility for locating LSP server executables
 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import { execSync, spawnSync } from "child_process";
import type { BinFindStrategy, BinFindStrategyItem } from "../config/schema.ts";
import { mcpDebugWithPrefix } from "./mcp-logger.ts";

/** `dir` followed by each of its ancestors up to the filesystem root. */
function* selfAndAncestors(dir: string): Generator<string> {
  let current = dir;
  while (true) {
    yield current;
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

/**
 * Find a binary using the specified strategy
 *
 * Strategies are tried in the order specified in the configuration.
 * Each strategy type has its own search logic.
 *
 * @param strategy The binary find strategy configuration
 * @param projectRoot The project root directory
 * @returns The resolved command and args, or null if not found
 */
export function findBinary(
  strategy: BinFindStrategy,
  projectRoot: string = process.cwd(),
): { command: string; args: string[] } | null {
  mcpDebugWithPrefix(
    "BinFinder",
    `Searching for binary with strategy:`,
    strategy,
  );

  const defaultArgs = strategy.defaultArgs || [];

  // Try each strategy in order
  for (const item of strategy.strategies) {
    mcpDebugWithPrefix("BinFinder", `Trying strategy: ${item.type}`);
    const found = findWithItem(item, projectRoot, defaultArgs);
    if (found) {
      return found;
    }
  }

  mcpDebugWithPrefix("BinFinder", `Binary not found with any strategy`);
  return null;
}

type Found = { command: string; args: string[] };

function findWithItem(
  item: BinFindStrategyItem,
  projectRoot: string,
  defaultArgs: string[],
): Found | null {
  switch (item.type) {
    case "venv": {
      // Search in Python virtual environments of the project and its ancestors
      const venvDirs = item.venvDirs || [".venv", "venv"];
      for (const name of item.names) {
        for (const dir of selfAndAncestors(projectRoot)) {
          for (const venvDir of venvDirs) {
            const venvBin = join(dir, venvDir, "bin", name);
            if (existsSync(venvBin)) {
              mcpDebugWithPrefix(
                "BinFinder",
                `Found in Python ${venvDir}: ${venvBin}`,
              );
              return { command: venvBin, args: defaultArgs };
            }
          }
        }
      }
      return null;
    }

    case "node_modules": {
      // The nearest node_modules/.bin that has one of the names
      const args = item.args ?? defaultArgs;
      for (const dir of selfAndAncestors(projectRoot)) {
        for (const name of item.names) {
          const bin = join(dir, "node_modules", ".bin", name);
          if (existsSync(bin)) {
            mcpDebugWithPrefix("BinFinder", `Found in node_modules: ${bin}`);
            return accept(
              { command: bin, args },
              item,
              projectRoot,
              defaultArgs,
            );
          }
        }
      }
      return null;
    }

    case "global": {
      // Search globally installed binaries
      const args = item.args ?? defaultArgs;
      for (const name of item.names) {
        try {
          const globalPath = execSync(`which ${name}`, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "ignore"], // Suppress stderr
          }).trim();
          if (globalPath) {
            mcpDebugWithPrefix("BinFinder", `Found globally: ${globalPath}`);
            return accept(
              { command: globalPath, args },
              item,
              projectRoot,
              defaultArgs,
            );
          }
        } catch {
          // Not found globally, continue to next name
        }
      }
      return null;
    }

    case "uv": {
      // Use UV run for Python packages
      try {
        execSync("which uv", {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "ignore"],
        });

        // Check if uv.lock exists in the project (indicates uv sync has been run)
        const uvLockPath = join(projectRoot, "uv.lock");
        const pyprojectPath = join(projectRoot, "pyproject.toml");

        if (existsSync(uvLockPath) || existsSync(pyprojectPath)) {
          // Project uses uv, use uv run
          mcpDebugWithPrefix(
            "BinFinder",
            `Using uv run: ${item.command || item.tool}`,
          );

          if (item.command) {
            // Use specific command from the tool
            return {
              command: "uv",
              args: ["run", item.command, ...defaultArgs],
            };
          } else {
            // Use tool directly
            return {
              command: "uv",
              args: ["run", item.tool, ...defaultArgs],
            };
          }
        } else {
          // No uv.lock, try uv tool run instead
          mcpDebugWithPrefix("BinFinder", `Using uv tool run: ${item.tool}`);

          if (item.command) {
            // Use specific command from the tool
            return {
              command: "uv",
              args: [
                "tool",
                "run",
                "--from",
                item.tool,
                item.command,
                ...defaultArgs,
              ],
            };
          } else {
            // Use tool directly
            return {
              command: "uv",
              args: ["tool", "run", item.tool, ...defaultArgs],
            };
          }
        }
      } catch {
        mcpDebugWithPrefix("BinFinder", `uv not found, skipping uv strategy`);
      }
      return null;
    }

    case "npx": {
      // Use NPX to run package
      mcpDebugWithPrefix("BinFinder", `Using npx: ${item.package}`);
      return {
        command: "npx",
        args: ["-y", item.package, ...defaultArgs],
      };
    }

    case "path": {
      // Use direct path (expand ~ for home directory)
      const expandedPath = item.path.replace(
        /^~/,
        process.env.HOME || process.env.USERPROFILE || "",
      );
      if (existsSync(expandedPath)) {
        mcpDebugWithPrefix("BinFinder", `Found at path: ${expandedPath}`);
        return { command: expandedPath, args: defaultArgs };
      }
      return null;
    }
  }
}

/**
 * A found binary is used as is unless the item has `ifFail`; then it must
 * answer an LSP initialize request, otherwise the `ifFail` strategies decide.
 */
function accept(
  found: Found,
  item: { ifFail?: BinFindStrategyItem[] },
  projectRoot: string,
  defaultArgs: string[],
): Found | null {
  if (!item.ifFail || speaksLsp(found)) {
    return found;
  }
  mcpDebugWithPrefix(
    "BinFinder",
    `${found.command} ${found.args.join(" ")} did not answer initialize; trying ifFail strategies`,
  );
  return findBinary({ strategies: item.ifFail, defaultArgs }, projectRoot);
}

const INITIALIZE_REQUEST = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { processId: null, rootUri: null, capabilities: {} },
});

/** Run the binary once with an initialize request on stdin; JSON-RPC frames on stdout mean it speaks LSP. */
function speaksLsp({ command, args }: Found): boolean {
  const result = spawnSync(command, args, {
    input: `Content-Length: ${Buffer.byteLength(INITIALIZE_REQUEST)}\r\n\r\n${INITIALIZE_REQUEST}`,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
    timeout: 10000,
  });
  return (result?.stdout ?? "").trimStart().startsWith("Content-Length:");
}

/**
 * Resolve the command for an adapter, using binFindStrategy if available
 *
 * @param adapter The adapter configuration
 * @param projectRoot The project root directory
 * @returns The resolved command and args
 */
export function resolveAdapterCommand(
  adapter: {
    bin?: string;
    args?: string[];
    binFindStrategy?: BinFindStrategy;
  },
  projectRoot?: string,
): { command: string; args: string[] } {
  // If bin and args are explicitly set, use them directly
  if (adapter.bin && adapter.args && adapter.args.length > 0) {
    mcpDebugWithPrefix(
      "BinFinder",
      `Using explicit bin/args: ${adapter.bin} ${adapter.args.join(" ")}`,
    );
    return {
      command: adapter.bin,
      args: adapter.args,
    };
  }

  // If binFindStrategy is available, use it
  if (adapter.binFindStrategy) {
    const found = findBinary(adapter.binFindStrategy, projectRoot);
    if (found) {
      return found;
    }
  }

  // Default: use bin as-is if available
  if (adapter.bin) {
    mcpDebugWithPrefix("BinFinder", `Using default bin: ${adapter.bin}`);
    return {
      command: adapter.bin,
      args: adapter.args || [],
    };
  }

  // No binary found
  throw new Error("No LSP server binary specified or found");
}
