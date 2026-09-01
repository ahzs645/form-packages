#!/usr/bin/env node
/**
 * Vendor Terra components into this package, adapted for React 19.
 *
 * Terra Core (Apache-2.0) was archived in 2024 with its peer dependencies
 * pinned to React 16, so it cannot be installed here. We copy the component
 * sources and apply a fixed set of mechanical rewrites:
 *
 *   1. `X.defaultProps = defaultProps; export default X;`
 *        -> `export default withDefaults(X, defaultProps);`
 *      React 19 ignores defaultProps on function components.
 *   2. external `terra-*` / `react-intl` imports -> our runtime shims or
 *      sibling vendored components.
 *   3. `terra-icon/lib/icon/IconX` -> a local component carrying that icon's
 *      real SVG path, so the 1.37 MB icon package stays out of the tree.
 *   4. dead IE/legacy polyfill imports dropped, and the two React-19-illegal
 *      constructs Terra still ships (string refs, react-lifecycles-compat)
 *      neutralised.
 *
 * Component bodies are otherwise untouched, so re-running this against a
 * newer Terra source keeps the fork cheap to maintain.
 *
 * Usage: node scripts/vendor.mjs <path-to-terra-core-main> [more-source-roots...]
 *
 * Each source root is a directory laid out as `packages/<pkg>/src`. Packages
 * listed in FRAMEWORK_PACKAGES live in terra-framework rather than terra-core;
 * if no source root provides them they are fetched with `npm pack` at the
 * pinned version into `.terra-cache/` (gitignored), so a from-scratch run needs
 * only the terra-core checkout plus network access once.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const outRoot = join(pkgRoot, "src", "vendor");
const cacheRoot = join(pkgRoot, ".terra-cache");

// terra-icon supplies the glyph geometry; pinned so re-runs are reproducible.
const ICON_VERSION = "3.62.0";

const sourceRoots = process.argv.slice(2);
if (!sourceRoots.length || !existsSync(join(sourceRoots[0], "packages"))) {
  console.error("usage: node scripts/vendor.mjs <path-to-terra-core-main> [more-source-roots...]");
  process.exit(1);
}

// Components we render, from terra-core.
const PACKAGES = [
  "terra-button",
  "terra-form-input",
  "terra-form-textarea",
  "terra-form-field",
  "terra-form-checkbox",
  "terra-form-radio",
  "terra-form-fieldset",
  "terra-form-select",
  "terra-alert",
  "terra-heading",
  "terra-divider",
  "terra-hyperlink",
  "terra-html-table",
  "terra-visually-hidden-text",
  "terra-demographics-banner",
  "terra-responsive-element",
  "terra-breakpoints",
  // Pulled in by terra-popup (framework) below.
  "terra-content-container",
  "terra-scroll",
];

/**
 * Packages that live in terra-framework, not terra-core. terra-framework is
 * not checked out here, so these come from the npm tarball at a pinned
 * version — the published tarballs ship `src/`, which is what we adapt.
 * They are deliberately NOT dependencies of this package: they pin React 16.
 */
const FRAMEWORK_PACKAGES = {
  "terra-hookshot": "5.44.0", // dropdown/popup positioning + portal
  "terra-popup": "6.85.1", // date picker's calendar container
  "terra-date-picker": "4.110.3", // includes its own fork of react-datepicker
};

// SCSS-only support package pulled in via webpack-style `~` imports.
const SCSS_PACKAGES = ["terra-mixins"];

// Alternate Terra themes we do not render. Dropping them removes both the
// bulk of the CSS and their dependency on licensed Oracle theme properties.
const SKIP_THEMES = ["clinical-lowlight-theme", "orion-fusion-theme", "redwood-theme"];

/**
 * Which moment-timezone build the date picker imports.
 *
 * The default entry point bundles the full IANA database — 720 KB minified,
 * and by far the largest single cost of vendoring terra-date-picker. Swap in
 * 'moment-timezone/builds/moment-timezone-with-data-1970-2030' to drop ~586 KB
 * raw (~145 KB gzip). We keep the full database because the picker's only use
 * of timezone data is resolving a date-only value inside `initialTimeZone`,
 * and dates of birth routinely predate 1970, where a truncated database falls
 * back to the nearest known offset and can shift the rendered day.
 */
const MOMENT_TIMEZONE_BUILD = "moment-timezone";

const icons = new Set();

/** Locate `<root>/packages/<pkg>/src` across the supplied source roots. */
function findPackage(pkg) {
  for (const root of sourceRoots) {
    const dir = join(root, "packages", pkg);
    if (existsSync(join(dir, "src"))) return dir;
  }
  return null;
}

/** `npm pack` a terra-framework package and extract it under .terra-cache. */
function fetchFromNpm(pkg, version) {
  const dest = join(cacheRoot, `${pkg}-${version}`);
  if (existsSync(join(dest, "package", "src"))) return join(dest, "package");
  mkdirSync(dest, { recursive: true });
  console.log(`  fetching ${pkg}@${version} from npm...`);
  const tarball = execFileSync("npm", ["pack", `${pkg}@${version}`, "--silent", "--pack-destination", dest], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .pop();
  execFileSync("tar", ["xzf", join(dest, tarball), "-C", dest]);
  return join(dest, "package");
}

function rewrite(code, fileDir) {
  const toRuntime = relative(fileDir, join(outRoot, "..", "runtime")).split("\\").join("/");
  const rel = (p) => (p.startsWith(".") ? p : "./" + p);

  let out = code;

  // 1. shims
  out = out.replace(/from 'terra-theme-context'/g, `from '${rel(toRuntime)}/theme-context'`);
  out = out.replace(/from 'react-intl'/g, `from '${rel(toRuntime)}/intl'`);
  // react-onclickoutside resolves its target with ReactDOM.findDOMNode, which
  // React 19 removed outright; runtime/on-click-outside is a like-for-like
  // replacement that reads the wrapped instance's own element ref instead.
  out = out.replace(/from 'react-onclickoutside'/g, `from '${rel(toRuntime)}/on-click-outside'`);
  // react-lifecycles-compat backports getDerivedStateFromProps to React <16.3.
  // React 19 supports it natively, so the polyfill is the identity function.
  out = out.replace(/from 'react-lifecycles-compat'/g, `from '${rel(toRuntime)}/lifecycles-compat'`);

  // 2. dead polyfills for browsers we do not target (IE10/11, old Safari).
  out = out.replace(/^import 'mutationobserver-shim';\n/m, "");
  out = out.replace(/^import 'classlist-polyfill';.*\n/m, "");
  // `require('wicg-inert/dist/inert')` is a bare CommonJS side-effect call
  // guarded by an IE check; Vite cannot resolve `require` in an ES module.
  out = out.replace(/^.*require\('wicg-inert\/dist\/inert'\);.*\n/gm, "");

  // 3. string refs (`ref="options"`), removed in React 19. The two occurrences
  //    in the date picker's dropdowns are write-only — nothing reads
  //    `this.refs` — so dropping them is behaviour-preserving.
  out = out.replace(/^\s*ref="\w+"\n/gm, "");

  // 4. icons -> generated stubs. Two import shapes exist: a deep default
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

  // 5. sibling vendored packages
  out = out.replace(/from '(terra-[a-z-]+)'/g, (_m, pkg) => {
    const toVendor = relative(fileDir, outRoot).split("\\").join("/");
    return `from '${rel(toVendor)}/${pkg}'`;
  });

  // 6. moment-timezone build selection (see MOMENT_TIMEZONE_BUILD).
  if (MOMENT_TIMEZONE_BUILD !== "moment-timezone") {
    out = out.replace(/from 'moment-timezone'/g, `from '${MOMENT_TIMEZONE_BUILD}'`);
  }

  // 7. a few helpers are CommonJS; Vite treats vendored .js as ESM.
  out = out.replace(/^module\.exports = (\w+);$/m, "export default $1;");

  // 8. defaultProps -> withDefaults(...)
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

function rewriteScss(css, fileDir) {
  const toVendor = relative(fileDir, outRoot).split("\\").join("/") || ".";
  const prefix = toVendor.startsWith(".") ? toVendor : "./" + toVendor;
  let out = css;
  // Webpack's `~pkg` node_modules prefix, which sass and Vite do not resolve;
  // point it at the vendored copy instead. Terra publishes SCSS under lib/.
  out = out.replace(/@import '~(terra-[a-z-]+)\/lib\/([^']+)'/g, (_m, pkg, path) => `@import '${prefix}/${pkg}/${path}'`);
  // Redwood mixins live in terra-theme-properties, which ships only licensed
  // Oracle fonts plus this sheet; the orion-fusion theme is not one we render.
  out = out.replace(/@import '~terra-theme-properties[^']*';\n?/g, "");
  // Terra scopes writing-direction-sensitive rules under `[dir=ltr]`/`[dir=rtl]`
  // and relies on terra-base to stamp `dir` on <html>. We do not vendor
  // terra-base, so on a document that never sets `dir` those rules simply never
  // match — which silently drops `position: absolute` from Hookshot's content
  // and leaves every dropdown and popup laid out in the page flow. Treat an
  // absent `dir` as ltr, which is what the HTML spec already says it means.
  out = out.replace(/^([ \t]*)\[dir=ltr\] &/gm, "$1[dir=ltr] &,\n$1:root:not([dir]) &");
  out = out.replace(/\[dir=ltr\](\s*),/g, "[dir=ltr], :root:not([dir])$1,");
  // Terra sheets unconditionally import every bundled theme, which is why one
  // component ships ~38 KB of CSS. We render the default theme only, so drop
  // the others (re-enable clinical-lowlight here for PowerChart dark mode).
  // The relative depth varies (`./`, `../`, `../../`), hence the loose prefix.
  for (const theme of SKIP_THEMES) {
    out = out.replace(new RegExp(`@import '[^']*${theme}/[^']*';\\n?`, "g"), "");
  }
  // Several sheets call `inline-svg()` — the Sass function that turns Terra's
  // caret, checkmark and dismiss glyphs into data-URI backgrounds — but reach
  // its definition only transitively, through the theme sheets we just
  // dropped. Left unresolved it is not a build error: the literal text
  // `inline-svg('<svg…>')` is emitted, the browser rejects the declaration as
  // invalid, and the glyph silently renders blank. Import Mixins directly
  // wherever the function is used.
  if (/\binline-svg\(/.test(out) && !/terra-mixins\/Mixins/.test(out)) {
    out = `@import '${prefix}/terra-mixins/Mixins';\n\n${out}`;
  }
  return out;
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const allPackages = [...PACKAGES, ...Object.keys(FRAMEWORK_PACKAGES)];

let copied = 0;
for (const pkg of allPackages) {
  let pkgDir = findPackage(pkg);
  if (!pkgDir && FRAMEWORK_PACKAGES[pkg]) {
    pkgDir = fetchFromNpm(pkg, FRAMEWORK_PACKAGES[pkg]);
  }
  if (!pkgDir) {
    console.warn("skip (not found):", pkg);
    continue;
  }
  const dest = join(outRoot, pkg);
  cpSync(join(pkgDir, "src"), dest, { recursive: true });

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (/\.jsx?$/.test(entry)) {
        writeFileSync(full, rewrite(readFileSync(full, "utf8"), dirname(full)));
        copied += 1;
      } else if (/\.scss$/.test(entry)) {
        writeFileSync(full, rewriteScss(readFileSync(full, "utf8"), dirname(full)));
      }
    }
  };
  const dropThemes = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (SKIP_THEMES.includes(entry)) rmSync(full, { recursive: true, force: true });
      else dropThemes(full);
    }
  };
  dropThemes(dest);
  walk(dest);

  // Terra packages resolve via their package.json `main` (lib/Foo.js). We copy
  // only src/, so emit the equivalent barrel for sibling imports like
  // `from 'terra-responsive-element'` to resolve after rewriting. Packages
  // whose main is already an index (terra-form-select) ship their own.
  try {
    const meta = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    const entry = String(meta.main || "").replace(/^lib\//, "").replace(/\.js$/, "");
    if (entry && !existsSync(join(dest, `${entry}.js`)) && existsSync(join(dest, `${entry}.jsx`))) {
      writeFileSync(join(dest, "index.js"), `export { default } from './${entry}';\nexport * from './${entry}';\n`);
    }
  } catch {
    /* package without a usable main; sibling imports will point at files directly */
  }
}

for (const pkg of SCSS_PACKAGES) {
  const pkgDir = findPackage(pkg);
  if (!pkgDir) continue;
  cpSync(join(pkgDir, "src"), join(outRoot, pkg), { recursive: true });
}

// Generate the icons actually referenced, carrying terra-icon's real glyph
// geometry. Only the handful of icons our components import are emitted, so
// the 1.37 MB / 1,646-file package stays out of the tree while the rendering
// still matches Terra. terra-icon is Apache-2.0, same as terra-core.
const iconDir = join(pkgRoot, "src", "runtime", "icons");
mkdirSync(iconDir, { recursive: true });
const iconSrc = join(fetchFromNpm("terra-icon", ICON_VERSION), "src", "icon");

/** Pull the viewBox and the SVG body out of one terra-icon source file. */
function readGlyph(name) {
  const file = join(iconSrc, `${name}.jsx`);
  if (!existsSync(file)) return null;
  const jsx = readFileSync(file, "utf8");
  const body = jsx.match(/<IconBase\b[^>]*>([\s\S]*?)<\/IconBase>/)?.[1];
  const viewBox = jsx.match(/"viewBox":"([^"]+)"/)?.[1];
  if (!body || !viewBox) return null;
  // Terra writes ` >` before closing; JSX is otherwise already valid for us.
  return { viewBox, body: body.trim().replace(/\s+>/g, ">") };
}

const missing = [];
for (const name of icons) {
  const glyph = readGlyph(name);
  if (!glyph) {
    missing.push(name);
    continue;
  }
  writeFileSync(
    join(iconDir, `${name}.tsx`),
    `import React from "react";\n\n` +
      `/**\n` +
      ` * terra-icon/${name}, inlined. Only the icons our components reference are\n` +
      ` * vendored; the full package is 1.37 MB across 1,646 files.\n` +
      ` *\n` +
      ` * Sized in \`em\` and filled with \`currentColor\`, matching terra-icon's\n` +
      ` * IconBase, so an icon inherits the size and colour of surrounding text.\n` +
      ` */\n` +
      `const ${name}: React.FC<{ a11yLabel?: string; className?: string }> = ({ a11yLabel, className }) => (\n` +
      `  <svg\n` +
      `    className={className}\n` +
      `    viewBox="${glyph.viewBox}"\n` +
      `    xmlns="http://www.w3.org/2000/svg"\n` +
      `    width="1em"\n` +
      `    height="1em"\n` +
      `    focusable="false"\n` +
      `    style={{ display: "inline-block", verticalAlign: "-0.15em", fill: "currentColor" }}\n` +
      `    role={a11yLabel ? "img" : "presentation"}\n` +
      `    aria-label={a11yLabel}\n` +
      `  >\n` +
      `    {a11yLabel ? <title>{a11yLabel}</title> : null}\n` +
      `    ${glyph.body}\n` +
      `  </svg>\n` +
      `);\n\nexport default ${name};\n`,
  );
}
if (missing.length) {
  console.warn(`  no glyph in terra-icon for: ${missing.join(", ")}`);
}

// terra-base normalises the document: it is where Terra's whole `rem` scale
// comes from (`font-size: 87.5%` => a 14px root) and where box-sizing is set.
// Without it every Terra dimension renders 16/14 too large and padded elements
// overflow. We cannot apply it to `html` unconditionally — the player also
// renders MOIS forms through Fluent on the same document, and a Cerner
// Component slot belongs to the host page — so the selectors are scoped to a
// `terra-base` class that <TerraBase> puts on the document only while a Terra
// tree is mounted.
{
  const basePkg = findPackage("terra-base");
  if (basePkg) {
    const raw = readFileSync(join(basePkg, "src", "Base.scss"), "utf8");
    const scoped = raw
      // Alternate themes are not vendored.
      .replace(/^@import\s+'\.\/[^']*';\s*$/gm, "")
      .replace(/^html\s*\{/m, "html.terra-base {")
      .replace(/^body\s*\{/m, "html.terra-base body {")
      .replace(/^\*,\n\*::before,\n\*::after\s*\{/m,
        "html.terra-base *,\nhtml.terra-base *::before,\nhtml.terra-base *::after {")
      .replace(/\n{3,}/g, "\n\n")
      .trimStart();
    writeFileSync(
      join(pkgRoot, "src", "runtime", "terra-base.scss"),
      `/*\n * Generated from terra-base/src/Base.scss by scripts/vendor.mjs.\n` +
        ` * Selectors are scoped to \`html.terra-base\`; see <TerraBase>.\n */\n` +
        scoped,
    );
  } else {
    console.warn("  terra-base not found in any source root; terra-base.scss not regenerated");
  }
}

writeFileSync(
  join(iconDir, "index.ts"),
  [...icons].sort().map((n) => `export { default as ${n} } from "./${n}";`).join("\n") + "\n",
);

console.log(`vendored ${copied} files from ${allPackages.length} packages; generated ${icons.size} icons`);
