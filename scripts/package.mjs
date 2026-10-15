import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const requiredFiles = ["manifest.json", "popup.html", "popup.css", "popup.js", "background.js", "src", "icons"];

for (const file of requiredFiles) {
  try {
    await stat(path.join(root, file));
  } catch {
    throw new Error(`Required extension file is missing: ${file}`);
  }
}

for (const size of [16, 32, 48, 128]) {
  const icon = path.join(root, manifest.icons?.[size] || "");
  if (!manifest.icons?.[size] || !(await stat(icon)).isFile()) {
    throw new Error(`Manifest icon ${size} is missing: ${manifest.icons?.[size] || "not configured"}`);
  }
}

const zip = spawnSync("zip", ["-v"], { encoding: "utf8" });
if (zip.error || zip.status !== 0) {
  throw new Error("The package command requires the `zip` utility to be installed.");
}

const dist = path.join(root, "dist");
const output = path.join(dist, `ChatEcho-${manifest.version}-chrome.zip`);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const extensionFiles = ["manifest.json", "popup.html", "popup.css", "popup.js", "background.js", "src", "icons"];
const result = spawnSync("zip", ["-q", "-r", output, ...extensionFiles], {
  cwd: root,
  encoding: "utf8"
});
if (result.error || result.status !== 0) {
  throw new Error(result.error?.message || result.stderr || "Failed to create the Chrome Web Store ZIP.");
}

const listing = spawnSync("unzip", ["-Z1", output], { encoding: "utf8" });
if (listing.error || listing.status !== 0 || !listing.stdout.split(/\r?\n/).includes("manifest.json")) {
  throw new Error("The ZIP was created without manifest.json at its root.");
}

console.log(`Created ${path.relative(root, output)} (${(await stat(output)).size} bytes)`);
