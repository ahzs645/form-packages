#!/usr/bin/env node
/**
 * Vendor Terra Core components into this package, adapted for React 19.
 *
 * Terra Core (Apache-2.0) was archived in 2024 with its peer dependencies
 * pinned to React 16, so it cannot be installed here. We copy the component
 * sources and apply three mechanical rewrites:
 *
 *   1. `X.defaultProps = defaultProps; export default X;`
 *        -> `export default withDefaults(X, defaultProps);`
 *      React 19 ignores defaultProps on function components.
 *   2. external `terra-*` / `react-intl` imports -> our runtime shims or
 *      sibling vendored components.
 *   3. `terra-icon/lib/icon/IconX` -> a generated local SVG stub, so the
 *      1.37 MB icon package stays out of the tree.
 *
 * Component bodies are otherwise untouched, so re-running this against a
 * newer Terra source keeps the fork cheap to maintain.
 *
 * Usage: node scripts/vendor.mjs <path-to-terra-core-main>
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outRoot = join(here, "..", "src", "vendor");

const source = process.argv[2];
if (!source || !existsSync(join(source, "packages"))) {
  console.error("usage: node scripts/vendor.mjs <path-to-terra-core-main>");
  process.exit(1);
}

// Components we render. terra-form-select is deliberately excluded: it is 33
// files and Fluent's Dropdown already covers that control.
const PACKAGES = [
  "terra-button",
  "terra-form-input",
  "terra-form-textarea",
  "terra-form-field",
  "terra-form-checkbox",
  "terra-form-radio",
  "terra-form-fieldset",
  "terra-alert",
  "terra-heading",
  "terra-divider",
  "terra-hyperlink",
  "terra-html-table",
  "terra-visually-hidden-text",
  "terra-demographics-banner",
  "terra-responsive-element",
  "terra-breakpoints",
];

// SCSS-only support package pulled in via webpack-style `~` imports.
const SCSS_PACKAGES = ["terra-mixins"];

// Alternate Terra themes we do not render. Dropping them removes both the
// bulk of the CSS and their dependency on licensed Oracle theme properties.
const SKIP_THEMES = ["clinical-lowlight-theme", "orion-fusion-theme", "redwood-theme"];

const icons = new Set();

function rewrite(code, fileDir) {
  const toRuntime = relative(fileDir, join(outRoot, "..", "runtime")).split("\\").join("/");
  const rel = (p) => (p.startsWith(".") ? p : "./" + p);

  let out = code;

  // 1. shims
  out = out.replace(/from 'terra-theme-context'/g, `from '${rel(toRuntime)}/theme-context'`);
  out = out.replace(/from 'react-intl'/g, `from '${rel(toRuntime)}/intl'`);

  // 2. icons -> generated stubs. Two import shapes exist: a deep default
  //    import, and named imports off the package barrel.
  out = out.replace(/from 'terra-icon\/lib\/icon\/(\w+)'/g, (_m, name) => {
    icons.add(name);
    return `from '${rel(toRuntime)}/icons/${name}'`;
  });
  out = out.replace(/import \{([^}]+)\} from 'terra-icon';/g, (_m, names) => {
    for (const raw of names.split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name) icons.add(name);
    }
    return `import {${names}} from '${rel(toRuntime)}/icons';`;
  });

  // 3. sibling vendored packages
  out = out.replace(/from '(terra-[a-z-]+)'/g, (_m, pkg) => {
    const toVendor = relative(fileDir, outRoot).split("\\").join("/");
    return `from '${rel(toVendor)}/${pkg}'`;
  });

  // 4. a few helpers are CommonJS; Vite treats vendored .js as ESM.
  out = out.replace(/^module\.exports = (\w+);$/m, "export default $1;");

  // 5. defaultProps -> withDefaults(...)
  const dp = out.match(/^(\w+)\.defaultProps = (\w+);$/m);
  if (dp) {
    const [, comp, defs] = dp;
    out = out.replace(new RegExp(`^${comp}\\.defaultProps = ${defs};\\n`, "m"), "");
    const isClass = new RegExp(`class ${comp} extends`).test(out);
    if (!isClass) {
      out = out.replace(
        new RegExp(`export default ([\\w()]*${comp}[\\w()]*);`),
        (_m, expr) => `export default withDefaults(${expr}, ${defs});`,
      );
      out = `import { withDefaults } from '${rel(toRuntime)}/with-defaults';\n` + out;
    } else {
      // Classes still honour defaultProps in React 19; restore the line.
      out = out.replace(/\nexport default/, `\n${comp}.defaultProps = ${defs};\n\nexport default`);
    }
  }
  return out;
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

let copied = 0;
for (const pkg of PACKAGES) {
  const src = join(source, "packages", pkg, "src");
  if (!existsSync(src)) {
    console.warn("skip (not found):", pkg);
    continue;
  }
  const dest = join(outRoot, pkg);
  cpSync(src, dest, { recursive: true });

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (/\.jsx?$/.test(entry)) {
        writeFileSync(full, rewrite(readFileSync(full, "utf8"), dirname(full)));
        copied += 1;
      } else if (/\.scss$/.test(entry)) {
        // Skip the alternate theme sheets entirely (see THEMES below).
        // Terra's SCSS uses webpack's `~pkg` node_modules prefix, which sass
        // and Vite do not resolve; point it at the vendored copy instead.
        const toVendor = relative(dirname(full), outRoot).split("\\").join("/") || ".";
        const prefix = toVendor.startsWith(".") ? toVendor : "./" + toVendor;
        let css = readFileSync(full, "utf8");
        css = css.replace(/@import '~terra-mixins\/lib\/Mixins'/g, `@import '${prefix}/terra-mixins/Mixins'`);
        // Redwood mixins live in terra-theme-properties, which ships only
        // licensed Oracle fonts plus this sheet; the orion-fusion theme is
        // not one we render, so stub the import out.
        css = css.replace(/@import '~terra-theme-properties[^']*';\n?/g, "");
        // Terra sheets unconditionally import every bundled theme, which is
        // why one component ships ~38 KB of CSS. We render the default theme
        // only, so drop the others (re-enable clinical-lowlight here if we
        // ever want PowerChart dark mode).
        for (const theme of SKIP_THEMES) {
          css = css.replace(new RegExp(`@import '\\./${theme}/[^']*';\\n?`, "g"), "");
        }
        writeFileSync(full, css);
      }
    }
  };
  for (const theme of SKIP_THEMES) {
    rmSync(join(dest, theme), { recursive: true, force: true });
  }
  walk(dest);

  // Terra packages resolve via their package.json `main` (lib/Foo.js). We copy
  // only src/, so emit the equivalent barrel for sibling imports like
  // `from 'terra-responsive-element'` to resolve after rewriting.
  try {
    const meta = JSON.parse(readFileSync(join(source, "packages", pkg, "package.json"), "utf8"));
    const entry = String(meta.main || "").replace(/^lib\//, "").replace(/\.js$/, "");
    if (entry && existsSync(join(dest, `${entry}.jsx`))) {
      writeFileSync(join(dest, "index.js"), `export { default } from './${entry}';\nexport * from './${entry}';\n`);
    }
  } catch {
    /* package without a usable main; sibling imports will point at files directly */
  }
}

for (const pkg of SCSS_PACKAGES) {
  const src = join(source, "packages", pkg, "src");
  if (!existsSync(src)) continue;
  cpSync(src, join(outRoot, pkg), { recursive: true });
}

// Generate the icon stubs actually referenced.
const iconDir = join(here, "..", "src", "runtime", "icons");
mkdirSync(iconDir, { recursive: true });
for (const name of icons) {
  writeFileSync(
    join(iconDir, `${name}.tsx`),
    `import React from "react";\n\n` +
      `/** Stand-in for terra-icon/${name}; the icon package is 1.37 MB for 1,646 files. */\n` +
      `const ${name}: React.FC<{ a11yLabel?: string; className?: string }> = ({ a11yLabel, className }) => (\n` +
      `  <span className={className} role={a11yLabel ? "img" : undefined} aria-label={a11yLabel} aria-hidden={a11yLabel ? undefined : true}>\n` +
      `    &#9888;\n` +
      `  </span>\n` +
      `);\n\nexport default ${name};\n`,
  );
}

writeFileSync(
  join(iconDir, "index.ts"),
  [...icons].sort().map((n) => `export { default as ${n} } from "./${n}";`).join("\n") + "\n",
);

console.log(`vendored ${copied} files from ${PACKAGES.length} packages; generated ${icons.size} icon stubs`);
