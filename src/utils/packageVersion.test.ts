import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { installedPackageMajor } from "./packageVersion.ts";

describe("installedPackageMajor", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
  });

  function nodeModulesWith(name: string, packageJson: unknown): string {
    const root = mkdtempSync(join(tmpdir(), "lsmcp-pkgver-"));
    dirs.push(root);
    const pkgDir = join(root, "node_modules", name);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify(packageJson));
    return join(root, "node_modules");
  }

  it("reads the major of the installed version", () => {
    const nm = nodeModulesWith("typescript", { version: "7.0.2" });
    expect(installedPackageMajor(nm, "typescript")).toBe(7);
    expect(
      installedPackageMajor(
        nodeModulesWith("typescript", { version: "5.9.2" }),
        "typescript",
      ),
    ).toBe(5);
  });

  it("returns undefined when not installed or unreadable", () => {
    const nm = nodeModulesWith("typescript", { version: "7.0.2" });
    expect(installedPackageMajor(nm, "zod")).toBeUndefined();
    expect(
      installedPackageMajor(nodeModulesWith("typescript", {}), "typescript"),
    ).toBeUndefined();
  });
});
