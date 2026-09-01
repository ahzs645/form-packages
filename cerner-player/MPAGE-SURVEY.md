# What production MPages actually do

Notes from reading ten MPage codebases from three health systems — PHSA
(BC), Covenant Health (TN), and a US multi-facility system — spanning the
IE11 and Edge/WebView2 generations. `PLATFORM-NOTES.md` records what the
platform provides; this records what shipping teams do with it, and where our
own assumptions were confirmed or were missing something.

## Provenance and a licensing boundary

Most of these repos are built on `@clinicaloffice/clinical-office-mpage[-core]`,
which is **proprietary** (`"license": "UNLICENSED"`, served from a private
GitHub Packages registry) and carries an explicit no-copy notice from
Precision Healthcare Solutions. One repo also leaks the library's full
unminified source through checked-in sourcemaps.

Everything below is recorded as **observed wire format and platform
behaviour** — facts about how Cerner's bridge and CCL behave, which are not
the library's copyrightable expression. No vendor source is reproduced, and
`packages/cerner-ccl` remains clean-room. Treat those `.map` files as
contaminated.

## The headline: no Terra anywhere

Zero `terra-*` or `@cerner/*` packages across all ten repos — verified
against source, both `package-lock.json` files, and the committed `dist/`
bundles. What these teams actually ship inside an MPage:

- **Angular Material** — the vendor template's default, themed from a
  generated `theme.scss` and emitted as a separate `material-theme` bundle.
- **ng-zorro-antd (Ant Design)** — in the newest and largest production app.
- **PrimeNG** — in the CST Future Orders apps.
- **Bootstrap 3/4 + DataTables + FontAwesome** — the legacy components,
  loaded off a mapped drive (`I:\mPages\...`).

So our Terra target has **no prior art to copy**. The useful transfer is not
about Terra; it is that a non-Material design system (ng-zorro) demonstrably
ships fine inside an MPage, which de-risks the approach by analogy.

Two constraints that do apply directly to us:

- **Global CSS is treated as radioactive.** The vendor template's
  `styles.scss` is a single line: do not define any global styles, they will
  affect Cerner's own components. This is exactly why `<TerraBase>` is
  scoped and mounted only while a Terra tree is live.
- **Angular's `anyComponentStyle` budget is 2 KB warn / 4 KB error.** Terra's
  per-component CSS blows through that immediately. Not our bundler, but it
  tells you what reviewers there consider normal.

## IE11 → Edge/WebView2: what actually changed

Read from one app that exists in both generations, ~2 years apart.

**The Discern bridge went asynchronous.** Not just the factory — *every*
method returns a promise:

```js
// IE                                        // Edge
window.external.DiscernObjectFactory("POWERORDERS")   → .then(obj => …)
obj.CreateMOEW(...)                                   → .then(hMoew => …)
obj.InvokeActivateAction(...)                         → .then(ok => …)
obj.SignOrders(hMoew)                                 → .then(…)
```

Under Edge, `DiscernObjectFactory` object *properties* are promises too
(`await patientSearchObj.PersonId`), and the property casing is inconsistent
across Cerner builds — production code carries lowercase fallbacks.

Also: `new XMLCclRequest()` becomes available as a bare global, and
synchronous `open(..., false)` is gone.

**Bootstrapping moved to a custom element.** Both Edge-era templates replace
`bootstrap: [AppComponent]` with `ngDoBootstrap` + `createCustomElement`,
guarded by `customElements.get()` because Cerner can load the bundle twice
into one page. The build then concatenates `runtime + main + polyfills` into
one file with `outputHashing: "none"`, so the Cerner-side `<script src>`
never changes. **The React analogue for us is a web-component wrapper around
the Terra root**, so one artifact serves both the full page and a component
slot.

**Dropped in the Edge generation:** `iframe-resizer` (the IE shell iframed
the MPage, so the page had to self-report its height), `classlist.js`,
`polyfills.ts`, `.browserslistrc`, and es5 differential loading.

**Two WebView2 workarounds worth knowing:** icon *fonts* are unreliable, so
production code replaced `<i class="pi pi-search">` with hand-inlined
`<svg>`; and dropdown overlays need `appendTo="body"` to escape clipping.
Terra's Hookshot portal already does the equivalent.

**An unsolved pain point:** relative asset paths do not resolve once a bundle
is loaded into a Cerner page, and the production fix there was to hardcode an
absolute environment-specific hostname into a template. The better answer,
also present in the corpus, is a runtime `assets/config.json` carrying
`contextRoot` plus a domain list, loaded via `APP_INITIALIZER` — one artifact,
N domains, no rebuild.

## Transport: what we had right, and what we were missing

Confirmed unchanged across both library generations, matching what
`@webforms/cerner-core` already implements: `XMLCclRequest` → `setBlobIn` →
positional prompt; the `%PDF` / 492 handling; `$PAT_PersonId$` /
`$VIS_EncntrId$` macros; the `{forcef8}` replacer.

The prompt signature is six slots:

```
OUTDEV, PERSONID, ENCNTRID, USERID, INSTANCE, CONFIG_JSON
```

with the **instance index in slot 5** so CCL can echo it back — that is how a
pooled set of request objects demultiplexes replies. Under the web/proxy
fallback the same call is a form-encoded POST with the blob **hex-encoded**
both ways.

`{forcef8}` is worth restating because it is easy to get wrong: any JSON key
ending `Cd` / `Id` / `Float` whose value is a whole number must be emitted as
a bare float (`123.0`), because CCL types it `f8` and rejects an integer. The
libraries do it by stringifying to `"{forcef8}123.0{forcef8}"` and then
stripping the quotes with a regex.

Genuinely new to us:

- **`1CO_MPAGE_DM_INFO:GROUP1`** — `DM_INFO` used as a per-user key/value
  store through a stock script, with `clearPatientSource: true`. Real
  deployments keep column layouts and last-used form values there. **This is
  a ready-made form-draft/autosave mechanism with no DDL and no domain
  build** — the most directly useful find in the corpus.
- **`reqinfo->updt_app != 600005`** — refuse to write unless the call really
  came from PowerChart; and `reqinfo->updt_id` is the only trustworthy acting
  user id. Never take a user id from the payload.
- **`SET MODIFY MAXVARLEN 50000000`** — without it, large JSON in
  `_memory_reply_string` truncates silently.
- **`IF (CURRDBUSER = "V500_MPAGE") RDB ALTER SESSION SET CURRENT_SCHEMA = V500`**
  — over the MPages web tier the request runs as a different DB user with no
  default schema, so raw `RDB` queries fail. This is the "works in DVDev,
  empty in the MPage" bug.
- **`eks_put_source` with `isblob='1'` and a `gvc` field** — the escape hatch
  for payloads too large for the reply string.
- **`1co_show_service_dir`** in DVDev gives you the proxy target for a
  `/cclproxy` dev-server rewrite: real CCL against a real domain with hot
  reload, instead of compile-and-copy. The single most useful operational tip
  in the corpus.

## Bridge invocations, verbatim

The **discern meta tag**, unquoted attributes and all:

```html
<meta name=discern content=APPLINK,CCLLINK,MPAGES_EVENT,MPAGES_SVC_EVENT,XMLCCLREQUEST,CCLNEWSESSIONWINDOW http-equiv=Content-Type>
```

The longest capability list seen adds `CCLLINKPOPUP, CCLNEWWINDOW, CCLEVENT,
CCLEKSREPLYOBJECT`.

**The `<a id="applink">` trampoline.** Every `javascript:` bridge call is
routed through one hidden anchor rather than called inline, because direct
`window.external.MPAGES_EVENT(...)` calls are unreliable under both IE and
WebView2:

```js
const el = document.getElementById("applink");
el.href = 'javascript:APPLINK(0,"Powerchart.exe","/PERSONID=" + id + "")';
el.click();
```

`APPLINK` mode `0` opens a Cerner app, `100` opens an arbitrary URL;
`$APP_AppName$` targets the current app and `/FIRSTTAB=^Name^` a chart tab.

**Discern objects in use:** `POWERORDERS` (the MOEW create → act → sign →
destroy sequence), `PVVIEWERMPAGE` (order info, doc viewer, procedure
viewer), `PEXSCHEDULINGACTIONS`, `PVPATIENTSEARCHMPAGE` (how an
organizer-level page with no chart context acquires one — cancellation shows
up as an id of `0`, not a rejection).

## Practices worth stealing

- **Offline fixtures from scrambled real responses.** Capture a real CCL
  reply, run it through a PHI scrambler, commit the scrambled file, and
  branch on the same `inMpage` probe the transport already uses. Gives a real
  envelope to test against without PHI.
- **A service-driver CCL program.** One program, many services, dispatched on
  prompt `$2` with a JSON blob in `$3`; `cnvtjsontorec` in,
  `cnvtrectojson(reply, 4)` out. One CCL object to promote through domains
  instead of N, and it maps cleanly onto a `{action, payload}` envelope.
- **Config as a flat file read via `define rtl3`.** Site configuration with no
  table changes and no recompile, with an admin page writing it back.
- **`_Memory_Reply_String` save/restore plus
  `with replace("RECORD_DATA","TEMP_RECORD_DATA")`** when calling a stock
  `mp_*` script, so the callee cannot clobber your record or corrupt the
  reply stream.
- **Auto-bumping the patch version on every build**, surfaced in a corner of
  the UI — the deployed-version-identification story, and a good one.
- **A visible in-page log component, left in the deployed build**, so
  helpdesk can read errors back. WebView2 offers no devtools.

## Practices explicitly not worth copying

- A client-side hardcoded password gating an admin page.
- Feature flags returned as `vc` `"true"` / `"false"` and compared as strings
  — with at least one inverted-logic bug in the corpus.
- `DestroyMOEW` called only inside the success branch, leaking the handle on
  failure.
- Error handling that consists of `go to end_program`, which returns nothing
  and looks identical to "no data".
