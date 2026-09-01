# @webforms/cerner-terra

Cerner **Terra Core** components, vendored and adapted to run on React 19.

## Why vendored rather than installed

Terra Core is Apache-2.0, but the project was archived in 2024 — the entire
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
| `terra-icon/...` → `runtime/icons/*` | The icon package is 1.37 MB across 1,646 files; we generate stubs for the ~12 icons actually referenced. |
| `@import '~pkg/...'` → vendored path | Webpack's `~` prefix; sass and Vite do not resolve it. |
| alternate theme sheets dropped | Terra sheets import all bundled themes unconditionally — the main reason one component ships ~38 KB of CSS. Re-enable `clinical-lowlight-theme` in `SKIP_THEMES` for PowerChart dark mode. |
| `module.exports =` → `export default` | A few helpers are CommonJS. |

Types are hand-written in `src/types.ts` (Terra is PropTypes-based) and
attached at the barrel in `src/index.ts`.

## Cost

Adding all 14 components to the player measured **+58 KB CSS / +51 KB JS raw
(≈ +22 KB gzip)** — well below the ~68 KB gzip an npm install would have
cost, because the alternate themes and react-intl are gone.

## Status

The components render correctly under React 19 (see `TerraProbe` in
cerner-player). They are **not yet wired into a form render target** — see
the Terra target checklist in the Cerner integration docs.

Attribution and the full list of modifications are in `NOTICE`.
