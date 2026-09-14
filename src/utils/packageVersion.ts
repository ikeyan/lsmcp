import { existsSync, readFileSync } from "fs";
import { join } from "path";

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
    const major = parseInt(String(version), 10);
    return Number.isNaN(major) ? undefined : major;
  } catch {
    return undefined;
  }
}
