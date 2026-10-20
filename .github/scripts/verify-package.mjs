import { execSync } from "node:child_process";
import assert from "node:assert/strict";

// Inspect npm's actual allowlisted payload without creating a tarball.
const [pkg] = JSON.parse(
  execSync("npm pack --dry-run --json --ignore-scripts", {
    encoding: "utf8",
  }),
);
assert.equal(pkg.name, "opencode-account-rotate");
const expected = new Set(["package.json", "README.md"]);
for (const module of ["accounts", "dispatch", "index", "policy", "rotation"]) {
  expected.add(`dist/${module}.js`);
  expected.add(`dist/${module}.d.ts`);
}
assert.deepEqual(new Set(pkg.files.map((file) => file.path)), expected);
const { default: plugin } = await import("../../dist/index.js");
assert.equal(plugin.id, "opencode-account-rotate");
assert.equal(typeof plugin.setup, "function");
console.log(`Verified ${pkg.name}@${pkg.version}: ${pkg.files.length} files`);
