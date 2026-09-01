import { build, transform } from "esbuild";
import ts from "typescript";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "dist");

// esbuild handles TS + bundling but cannot lower to ES5; TypeScript's
// transpiler does the ES5 pass, then esbuild minifies the result.
const bundled = await build({
  entryPoints: [join(root, "src/shell-entry.ts")],
  bundle: true,
  format: "iife",
  target: "es2015",
  write: false,
});

const es5 = ts.transpileModule(bundled.outputFiles[0].text, {
  compilerOptions: { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.None },
}).outputText;

const minified = await transform(es5, { minify: true, target: "es5" });

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "cerner-shell.js"), minified.code);
await copyFile(join(root, "src/index.html"), join(outDir, "index.html"));
console.log("cerner-shell built:", minified.code.length, "bytes (ES5)");
