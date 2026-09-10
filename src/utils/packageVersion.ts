/**
 * Helpers for reading the major version of an npm package, either from the
 * installed copy in node_modules or from a semver range in package.json.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Major version implied by a semver string or range
 * ("7.0.2", "^7", "~7.1", ">=7.0.0", "=7", "v7"). For "a || b" ranges the
 * first alternative wins. Returns undefined for anything that does not
 * start with a version number ("*", "latest", "<7", "workspace:*").
 */
export function majorOf(range: unknown): number | undefined {
  if (typeof range !== "string") return undefined;
  const match = /^\s*(?:[\^~=]|>=?)?\s*v?(\d+)/.exec(range);
  return match ? Number(match[1]) : undefined;
}

/**
 * Major version of the package installed under `nodeModulesDir`, or undefined
 * when it is not installed or its package.json cannot be read.
 */
export function installedPackageMajor(
  nodeModulesDir: string,
  packageName: string,
): number | undefined {
  const packageJsonPath = join(nodeModulesDir, packageName, "package.json");
  if (!existsSync(packageJsonPath)) return undefined;
  try {
    const { version } = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return majorOf(version);
  } catch {
    return undefined;
  }
}

/**
 * Major version of a dependency of the project: the installed copy wins,
 * falling back to the range declared in package.json.
 */
export function dependencyMajor(
  projectRoot: string,
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  },
  packageName: string,
): number | undefined {
  return (
    installedPackageMajor(join(projectRoot, "node_modules"), packageName) ??
    majorOf(
      packageJson.devDependencies?.[packageName] ??
        packageJson.dependencies?.[packageName],
    )
  );
}
