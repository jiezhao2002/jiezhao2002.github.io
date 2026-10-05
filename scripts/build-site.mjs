import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apps = ["tree", "openworld"];
const output = join(root, "_site");
const appBuilds = [];

for (const app of apps) {
  const built = join(root, "tools", app, "dist");
  let source = built;
  try {
    if (!(await stat(built)).isDirectory()) throw new Error(`App build is not a directory: ${built}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (process.argv.includes(`--sync-${app}`)) throw new Error(`Build ${app} before syncing its published files: ${built}`);
    source = join(root, app);
  }
  appBuilds.push({ app, source });
}

async function checkPublicFiles(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name === ".DS_Store") continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) await checkPublicFiles(path);
    else {
      if (/^\.env|^\.dev\.vars|\.(pem|key)$/.test(item.name)) throw new Error(`Private file in public output: ${path}`);
      const content = await readFile(path, "utf8");
      if (/gsk_[A-Za-z0-9]{20,}/.test(content)) throw new Error(`Provider key in public output: ${path}`);
      // Auth-js retains an unused SDK default in its bundle. Openworld's build
      // validates its configured HTTPS endpoint before compiling; ignore only
      // one exact default literal identified by the SDK's own constants.
      const addresses = path.includes(`${sep}openworld${sep}`) && content.includes("X-Supabase-Api-Version") && content.includes("supabase.auth.token")
        ? content.replace(/(?<=["'\x60])http:\/\/localhost:9999(?=["'\x60])/, "")
        : content;
      if (item.name.endsWith(".js") && /https?:\/\/(localhost|127\.0\.0\.1):/.test(addresses)) {
        throw new Error(`Local backend address in production bundle: ${path}`);
      }
    }
  }
}

for (const { source } of appBuilds) await checkPublicFiles(source);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of [".nojekyll", "index.html", "styles.css", "script.js", "site-core.mjs", "blog", "desktop"]) {
  await cp(join(root, path), join(output, path), { recursive: true, filter: (file) => !file.endsWith(".DS_Store") });
}
for (const { app, source } of appBuilds) {
  await cp(source, join(output, app), { recursive: true });
}
await checkPublicFiles(output);

// GitHub Pages currently publishes committed files from master, not an Actions artifact.
for (const { app, source } of appBuilds) {
  if (!process.argv.includes(`--sync-${app}`)) continue;
  const publishedApp = join(root, app);
  await rm(publishedApp, { recursive: true, force: true });
  await cp(source, publishedApp, { recursive: true });
}
console.log(`Public site built at ${output}; private app source and credentials excluded.`);
