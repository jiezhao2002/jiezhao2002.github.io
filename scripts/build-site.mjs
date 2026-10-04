import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const treeBuild = join(root, "tools/tree/dist");
const output = join(root, "_site");

async function checkPublicFiles(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name === ".DS_Store") continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) await checkPublicFiles(path);
    else {
      if (/^\.env|^\.dev\.vars|\.(pem|key)$/.test(item.name)) throw new Error(`Private file in public output: ${path}`);
      const content = await readFile(path, "utf8");
      if (/gsk_[A-Za-z0-9]{20,}/.test(content)) throw new Error(`Provider key in public output: ${path}`);
      if (item.name.endsWith(".js") && /https?:\/\/(localhost|127\.0\.0\.1):/.test(content)) {
        throw new Error(`Local backend address in production bundle: ${path}`);
      }
    }
  }
}

await checkPublicFiles(treeBuild);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of [".nojekyll", "index.html", "styles.css", "script.js", "site-core.mjs", "blog", "desktop"]) {
  await cp(join(root, path), join(output, path), { recursive: true, filter: (file) => !file.endsWith(".DS_Store") });
}
await cp(treeBuild, join(output, "tree"), { recursive: true });
await checkPublicFiles(output);

if (process.argv.includes("--sync-tree")) {
  // GitHub Pages currently publishes committed files from master, not an Actions artifact.
  const publishedTree = join(root, "tree");
  await rm(publishedTree, { recursive: true, force: true });
  await cp(treeBuild, publishedTree, { recursive: true });
}
console.log(`Public site built at ${output}; private app source and credentials excluded.`);
