import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, "dist");

await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });

await Promise.all([
  cp(resolve(root, "manifest.json"), resolve(dist, "manifest.json")),
  cp(resolve(root, "src/options/options.html"), resolve(dist, "options/options.html"), {
    recursive: true
  }),
  cp(resolve(root, "src/popup/popup.html"), resolve(dist, "popup/popup.html"), {
    recursive: true
  })
]);

await esbuild.build({
  entryPoints: {
    background: resolve(root, "src/background.ts"),
    "content/github-pr": resolve(root, "src/content/github-pr.ts"),
    "options/options": resolve(root, "src/options/options.ts"),
    "popup/popup": resolve(root, "src/popup/popup.ts")
  },
  bundle: true,
  format: "iife",
  outdir: dist,
  platform: "browser",
  sourcemap: true,
  target: "chrome114"
});
