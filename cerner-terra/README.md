# @webforms/cerner-terra

Cerner **Terra** components, vendored and adapted to run on React 19.

## Why vendored rather than installed

Terra is Apache-2.0, but the project was archived in 2024 — the entire
`cerner` GitHub org (68 repos) is read-only, and the published packages pin
`peerDependencies: { react: "16" }` exactly. `npm i react@19` against them
fails with `ERESOLVE`, and forcing past it breaks at runtime: React 19 removed
`defaultProps` for function components, which is how Terra sets defaults in
398 of its source files. There is no maintained fork and no successor
(Oracle's Redwood is not published as a React library).

So we copy the sources and adapt them mechanically.

## How the adaptation works

`scripts/vendor.mjs <path-to-terra-core-main>` re-runs the whole process, so
the fork stays cheap to re-sync. Component bodies are never hand-edited; only
these rewrites are applied:

| Rewrite | Why |
|---|---|
| `X.defaultProps = d; export default X` → `export default withDefaults(X, d)` | React 19 ignores `defaultProps` on function components. Class components keep theirs (still honoured). |
| `react-intl` → `runtime/intl` | Terra's intl surface is a handful of literals; the real package's React peer tops out below 18. |
| `terra-theme-context` → `runtime/theme-context` | Upstream also pins React 16; components only read `{ className }`. |
| `react-onclickoutside` → `runtime/on-click-outside` | It locates its target with `ReactDOM.findDOMNode`, which React 19 removed — importing it throws. |
| `react-lifecycles-compat` → `runtime/lifecycles-compat` | Back-ports `getDerivedStateFromProps` to React &lt; 16.3; React 19 has it natively, so `polyfill` is the identity. |
| `terra-icon/...` → `runtime/icons/*` | The icon package is 1.37 MB across 1,646 files. The script pulls each referenced icon's real SVG path out of `terra-icon` (Apache-2.0, pinned) and emits a component for it — ~13 icons instead of 1,646. |
| `ref="options"` dropped | String refs are gone in React 19. The two in the date picker's dropdowns are write-only — nothing reads `this.refs`. |
| `mutationobserver-shim`, `classlist-polyfill`, `require('wicg-inert')` dropped | IE10/11 polyfills. The `require` is also unresolvable in an ES module. |
| `@import '~pkg/...'` → vendored path | Webpack's `~` prefix; sass and Vite do not resolve it. |
| `[dir=ltr]` selectors also match `:root:not([dir])` | Terra scopes direction-sensitive rules on `dir`, which `terra-base` stamps onto `<html>`. We do not vendor `terra-base`, so those rules never matched — silently dropping `position: absolute` from Hookshot's content and laying every dropdown and popup out in the page flow. An absent `dir` means ltr per the HTML spec. |
| alternate theme sheets dropped | Terra sheets import all bundled themes unconditionally — the main reason one component ships ~38 KB of CSS. Re-enable `clinical-lowlight-theme` in `SKIP_THEMES` for PowerChart dark mode. |
| `module.exports =` → `export default` | A few helpers are CommonJS. |
| `@import 'terra-mixins/Mixins'` injected where `inline-svg()` is used | Terra's caret, checkmark and dismiss glyphs are data-URI backgrounds built by that Sass function, but five sheets reach its definition only *through* the theme sheets on the row above. Unresolved it is not a build error — the literal text `inline-svg('<svg…>')` is emitted, the browser rejects the declaration, and the glyph renders blank. |
| `terra-base/src/Base.scss` → `runtime/terra-base.scss`, scoped to `html.terra-base` | Terra's whole `rem` scale depends on terra-base's 14px root; see [terra-base](#terra-base). |

`withDefaults` and `injectIntl` both hoist non-React statics, so Terra's
`Select.Option` / `Hookshot.Content` subcomponent API survives wrapping.

`withDefaults` also preserves the wrapped component's `name`. Terra dispatches
on `child.type.name` in places — `TableUtils.addScope` compares it against
`"TableHeaderCell"` to decide where `scope` goes — so a wrapper named
`Wrapped` silently strips the scope attribute from every table header.

Types are hand-written in `src/types.ts` (Terra is PropTypes-based) and
attached at the barrel in `src/index.ts`.

### terra-base

`terra-base` is where Terra normalises the document: `font-size: 87.5%` on
`html` (the **14px root** every `rem` in Terra is authored against),
`box-sizing: border-box`, the font stack, and body colour/line-height.
Skipping it does not fail — it just renders everything 16/14 too large with
`content-box` sizing.

Because `rem` resolves against the root element, it cannot be scoped to a
container. The script therefore emits `runtime/terra-base.scss` with the
selectors rewritten to `html.terra-base`, and the `<TerraBase>` component adds
that class only while a Terra tree is mounted. That keeps it off a host page
that is not ours — the player renders MOIS forms through Fluent on the same
document. `<TerraBase>` also stamps `dir`, which the `[dir=ltr]` rewrite above
otherwise works around.

### Locale

The fork defaults to **en-CA**, so terra-date-picker renders `YYYY-MM-DD`
rather than US order — on a clinical form `05/06` is genuinely ambiguous.

`runtime/moment-locale.ts` registers it, and does so through `moment-timezone`
rather than by importing `moment/locale/en-ca`. That file registers against
the `moment` *it* imports; pnpm resolves both to one package on disk, but Vite
pre-bundles CJS dependencies per entry and ends up with two module instances,
so the registration lands on the copy `DateUtil` never reads. It registers
only when a probe shows the format is actually wrong, so under Node — where
moment lazily `require`s the real locale file — nothing is redefined.

### terra-framework packages

`terra-hookshot`, `terra-popup` and `terra-date-picker` live in
**terra-framework**, which is not checked out here. `FRAMEWORK_PACKAGES` pins
their versions and the script `npm pack`s them into `.terra-cache/`
(gitignored) — the published tarballs ship `src/`, which is what we adapt.
They are deliberately not dependencies of this package.

## Cost

Adding the 13 original components to the player measured **+58 KB CSS /
+51 KB JS raw (≈ +22 KB gzip)** — well below the ~68 KB gzip an npm install
would have cost, because the alternate themes and react-intl are gone.

Adding select + date picker (six more packages) took the player from
66.4 KB CSS / 3,430 KB JS to **128.3 KB CSS / 4,488 KB JS** raw
(9.6 → 18.4 KB and 909 → 1,031 KB gzip). About 720 KB raw of that JS is
moment-timezone's packed IANA database, which the date picker's `DateUtil`
pulls in wholesale — see `MOMENT_TIMEZONE_BUILD` in the vendor script for the
trade-off, and note it is only ~19 KB gzip, since timezone tables compress
extremely well.

## Status

The components render correctly under React 19 (see `TerraProbe` in
cerner-player). `Select` (native, single and typeahead) and `DatePicker` were
additionally exercised by hand: dropdowns open through Hookshot's portal and
position against their target, the typeahead filters, and the calendar opens
in a Popup and writes back an ISO date.

`Combobox` and `MultiSelect` are exported but have not been driven directly;
they share the Frame the tested variants use. `TagSelect` is vendored but not
exported — nothing needs it yet.

Attribution and the full list of modifications are in `NOTICE`.

The form renderer built on these components is
`@webforms/cerner-terra-forms`.
