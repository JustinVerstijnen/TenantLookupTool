import { mkdir, copyFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
// Only public files enter the deployment artifact. Backend and local secrets stay out.
await mkdir(new URL("dist/assets/", root), { recursive: true });
for (const file of ["index.html", "staticwebapp.config.json"]) {
  await copyFile(new URL(file, root), new URL(`dist/${file}`, root));
}
for (const file of ["styles.css", "config.js", "script.js"]) {
  await copyFile(new URL(`assets/${file}`, root), new URL(`dist/assets/${file}`, root));
}
