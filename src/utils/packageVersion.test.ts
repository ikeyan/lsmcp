import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  dependencyMajor,
  installedPackageMajor,
  majorOf,
} from "./packageVersion.ts";

describe("majorOf", () => {
  it("reads the major from exact versions and ranges", () => {
    expect(majorOf("7.0.2")).toBe(7);
    expect(majorOf("^7")).toBe(7);
    expect(majorOf("~7.1.0")).toBe(7);
    expect(majorOf(">=7.0.0")).toBe(7);
    expect(majorOf("v5.9.2")).toBe(5);
    expect(majorOf("=7.0.0")).toBe(7);
    expect(majorOf("^5 || ^7")).toBe(5);
    expect(majorOf("7.0.0-dev.20250816.1")).toBe(7);
  });

  it("returns undefined for non-numeric ranges", () => {
    expect(majorOf("*")).toBeUndefined();
    expect(majorOf("latest")).toBeUndefined();
    expect(majorOf("<7")).toBeUndefined();
    expect(majorOf("workspace:*")).toBeUndefined();
    expect(majorOf(undefined)).toBeUndefined();
  });
});

describe("installedPackageMajor / dependencyMajor", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
  });

  function makeProject(installedVersion?: string): string {
    const root = mkdtempSync(join(tmpdir(), "lsmcp-pkgver-"));
    dirs.push(root);
    if (installedVersion) {
      const pkgDir = join(root, "node_modules", "typescript");
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(
        join(pkgDir, "package.json"),
        JSON.stringify({ name: "typescript", version: installedVersion }),
      );
    }
    return root;
  }

  it("reads the installed version", () => {
    const root = makeProject("7.0.2");
    expect(
      installedPackageMajor(join(root, "node_modules"), "typescript"),
    ).toBe(7);
    expect(installedPackageMajor(join(root, "node_modules"), "zod")).toBe(
      undefined,
    );
  });

  it("prefers the installed version over the declared range", () => {
    const root = makeProject("5.9.2");
    expect(
      dependencyMajor(
        root,
        { devDependencies: { typescript: "^7" } },
        "typescript",
      ),
    ).toBe(5);
  });

  it("falls back to the declared range when not installed", () => {
    const root = makeProject();
    expect(
      dependencyMajor(
        root,
        { dependencies: { typescript: "^7" } },
        "typescript",
      ),
    ).toBe(7);
    expect(dependencyMajor(root, {}, "typescript")).toBeUndefined();
  });
});
