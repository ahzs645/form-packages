# Cerner MPage platform notes

What the MPage platform provides, what it expects of us, and which pieces we
had to build ourselves. Companion to `DEPLOYMENT.md` (procedure),
`EXPORT-SHAPE.md` (what the builder's Cerner export contains, channel by
channel), `MPAGE-SURVEY.md` (what ten production MPages actually do with all
this), and `../cerner-ccl/PAYLOAD-REFERENCE.md` (server payload vocabulary).

## Where an MPage can run

Five hosting modes, all reachable with the same artifact:

| Mode | Patient context | Notes |
|---|---|---|
| Chart-level full page | current chart | our primary target |
| Organizer-level full page | none (`ORGANIZER` mode sends `0,0`) | worklists, dashboards |
| Workflow component | from the **host page's** query string | embedded card in a Workflow MPage |
| DA2 / Discern Web Services / plain browser | whatever you pass | our dev loop and the SMART path |
| CCL report output (Edge Discern Output Viewer in DA2, the Reporting Portal or PowerChart) | the clicked row's ids | a report opens a component beside or over its table; see below |

The platform's own guidance is to build a **full page unless you specifically
need a Workflow component** — components lose routing, config auto-load, and
same-origin asset access. Our packaging follows that: full page is the
default export, component is opt-in.

## Context plumbing, by mode

- **Full page in PowerChart** — the CCL prompt macros `$PAT_PersonId$` /
  `$VIS_EncntrId$` are substituted by the host at send time. Nothing to pass.
- **Workflow component** — prefmaint launches Cerner's host page with
  `pId` / `eId` / `uId` / `pCd` / `ppr` / `app` / `vId` in the query string;
  the component shares that page's `location`. Our element receives only
  `title` and `path`.
- **Anywhere else** — pass ids explicitly.

`resolveChartContext` covers all three (element attributes → our query names →
Cerner's short names), which is why the same build works in every mode.

**Both spellings are live.** Cerner's own host page uses the short names
above, but the Clinical Office component template reads `personId` /
`encounterId` / `userId` from the same query string, so a component dropped
into a vendor-built page may see either. `resolveChartContext` should accept
the long spellings as well as the short ones rather than assuming one house
style.

## Reusing a component outside the Workflow framework

The platform exposes an "embedded workflow" wrapper: look a component up by
its Bedrock name, hand it an explicit `personId`/`encntrId`, and render it
inside a full-page MPage — including at organizer level or in DA2, where a
real Workflow component cannot run. Signals-bound ids re-render it live, and
repeat loads of the same script are de-duplicated.

Our `<webforms-player>` already supports this shape directly: mount it in any
page and pass `person_id` / `encntr_id` attributes. If we ever need the
lookup-by-label indirection, that is a thin CCL call plus a script-injection
guard — the same thing the component host does.

## Testing an MPage without a domain

The PowerChart emulator's **Portal MPage** (`/tutorial/host/powerchart/?fixture=mpage`)
hosts any same-origin MPage against a simulated Millennium domain
(`packages/cerner-sim`): `XMLCclRequest` in PowerChart mode, Discern Web
Services (`/cclproxy`, `…/mpages/reports/<program>`, hex) in both modes, the
Clinical Office v5 and `nh_wf_entry` entry scripts, and a synthetic chart
built from the emulator's roster. Its picker lists the starter templates in
`public/mpages/custom_mpage_content/` and any folder in the git-ignored
`local-mpages/`; its **CCL** log shows each request and reply, with notices
where the simulator differs from production (`packages/cerner-sim/QUIRKS.md`).

The bridge has to exist before the page's scripts run, as it does in
PowerChart: pages load `/mpages/host/bootstrap.js` first (local folders get it
injected). Verified 2026-10-09 with the Clinical Office v5 setup app: it
loads, maps a component through `dm_info`, and the Workflow page then mounts
that component — in both transport modes.

## Hosting a form from a CCL report

The Edge Discern Output Viewer can render a Workflow component, so a CCL
report — run from DA2, the Discern Reporting Portal or a PowerChart report
tab — can open one for the row a user clicks. Prior art (a licensed report
viewer; we take the model, not the product) settles the shape:

- **Triggers:** a row click, a click on one column, a right-click menu entry,
  or a toolbar button. Toolbar actions have no row, so they take fixed
  values only.
- **Context comes from the row.** The report output carries `person_id` /
  `encntr_id` columns, which the viewer hides by default (every `_id` and
  `_cd` column is hidden unless asked for); the action names the columns
  to read.
- **Display:** a side panel by default, or a modal dialog with CSS height and
  width (`40vh` / `80vw`), dismissed by a close button or Escape. Several
  components on one action show as tabs; a short identifier strip (patient
  name, MRN, admit date — row columns with optional labels) sits above them.
  A one-line notice on load ("Click a row to …") tells users rows act.
- **Other row actions** in the same vocabulary, each already in our
  Discern catalogue (`@webforms/cerner-core`):

  | Action | Bridge call | Outside PowerChart |
  |---|---|---|
  | Open the chart, optionally at a named tab | `APPLINK` `/PERSONID /ENCNTRID /FIRSTTAB` | Edge: promise |
  | Open a PowerForm (new, existing activity, read only) | `MPAGES_EVENT("POWERFORM", "person\|encntr\|formId\|activityId\|chartMode")` | yes (`hosts: any`) |
  | View a result | `PVVIEWERMPAGE` Create/AppendEvent/LaunchEventViewer | — |
  | Run a CCL report, prompts in the report's order | `CCLLINK` | Edge: replaces the page by default |
  | Open a Workflow component | our `<webforms-player>` with `person_id` / `encntr_id` | yes |

This makes a **form-submissions worklist** cheap: a CCL report over our
`cust_nh_wf_reference` submission markers whose row click opens
`<webforms-player>` in a dialog. Not built. The PowerChart emulator's
"Discern Reporting Portal" toolbar button
(`hosts/powerchart/src/host/PowerChartShell.tsx`) only shows a notice today
and is the natural place to stage it.

Report-output conventions worth matching if we emit tabular output: a
multi-sheet export caps tab names at **31 characters** (Excel's sheet-name
limit); dates should leave CCL already formatted in the browser's
case-sensitive mask (see the cerner-ccl README); and large output is
compressed and base64-encoded into one package because the stock table
viewer truncates big results.

## Component catalogue (what the ecosystem ships)

Useful as a gap list: these are the UI capabilities a mature MPage stack
provides. Ours come from Fluent + the MOIS form runtime instead, so this is
"what a Cerner-native reviewer will expect to exist", not a shopping list.

- **Data display** — Table (sorting/filtering/paging/export in one binding),
  Tree (defaults to the location hierarchy), ScrollBar (standalone
  programmable scrollbar, vertical or horizontal).
- **Input** — Input (labels, titles, prefix/suffix icons and buttons),
  Select (searching plus large-list limiting), RadioButtons, DateRangePicker
  (less-than / greater-than / between / not-between), Button (4 styles × 4
  colours), DropDown (left/right-click popup on any element).
- **Chrome** — TabbedMenu (responsive), ConfirmDialog (modal with HTML body),
  Icon (Material Icons wrapper), OptionalTitle (suppresses empty `title`
  tooltips), PatientSearch (PowerChart-style patient/encounter search).
- **Layout directives** — RemainingScreenSpace (size an element to the
  leftover viewport), ResizeObserver, PreventScroll (stop wheel/key
  propagation escaping a focused pane — matters when several scrollable
  panes share one MPage).
- **Diagnostics** — a Log component with tabs, intended to be *left in the
  deployed build* so helpdesk can read errors back to developers. We ship the
  equivalent idea as the mock bridge's console log; a visible in-page log is
  still worth adding before a real pilot, since WebView2 offers no devtools.

## Platform gotchas we must respect

- **The Discern bridge does not work inside an `<iframe>` in an Edge
  Workflow component.** Calls that work on the page itself fail from a
  frame, which is why the vendor's v5 components mount as custom elements on
  the root page instead of framing their app. Our `<webforms-player>` mounts
  in place; never wrap it in a frame for a component placement. (The
  PowerChart emulator frames MPages and installs the bridge in the frame's
  own realm, so it is more permissive than the real client here.)
- **Overlays escape the component.** Dialogs and pop-ups render at the
  document root, outside the component's shadow root, so anything the
  component provides through context (services, theme, chart ids) does not
  reach them unless passed in explicitly. The vendor hands its services to
  each dialog by hand. Worse, when a user clicks a Workflow page's
  per-component **refresh** button the component re-mounts and loses its
  references to root-level overlays, so they stop appearing; the vendor's
  answer was a drop-down that renders inside the component. Our Fluent
  layers and portals carry the same risk in a component placement — test
  a callout after a component refresh.

- **Material Icons must be self-hosted.** Workflow components are isolated
  from the host page's CSS *except* fonts, so the icon font is installed once
  per domain next to the component framework's stylesheet. Anything we render
  with icons has to ship its own font or use text.
- **Static content is not live until refreshed.** Copying files to
  `custom_mpage_content` does nothing until `Refresh` runs on the MPages
  Static Content Management Page — a step that silently looks like "my
  deploy didn't work".
- **Custom tables need a per-node step.** Create on one node, run the oragen
  mode on every other node, then cycle servers 58/79/178/179.
- **Cross-origin hosting needs CORS** for both the component module script
  and any runtime asset fetches (our `forms/*/index.jsx`), and the component
  path must be reachable from the workstation.
- **Initialise one macrotask late.** The Clinical Office template defers all
  of its component start-up inside `setTimeout(…, 0)` and carries an in-code
  warning not to move initialisation outside it — the custom element is
  upgraded before the host's bridge is ready. Our element's
  `connectedCallback` should not touch the Discern bridge synchronously.
- **Overlay panes render transparent in a component placement.** The same
  template force-sets an opaque background on `.cdk-overlay-pane`, commented
  as fixing transparent drop-downs "in Cerner components". This is distinct
  from the clipping problem we solve with `appendTo="body"`: a portal can be
  positioned correctly and still paint see-through. Any Fluent callout,
  dropdown or dialog we render in a component placement needs an explicit
  opaque background.
- **Do not fetch fonts from a CDN.** That template links Roboto and Material
  Icons from `fonts.googleapis.com` at runtime, which fails on a hospital
  network without egress. It is wrong; our self-hosting rule above stands.
- **Component isolation cuts both ways.** The framework's convention is a
  shadow root with `all: initial`; we deliberately use light DOM so Fluent's
  `document.head` styles apply, accepting that the host page's CSS can reach
  our form. Revisit if a Workflow placement shows bleed.

## Chart-action identifiers

For the `DiscernActionsBar` buttons, ids come from these tables:

| Action | Id | Source |
|---|---|---|
| Open PowerForm | `formId` | `DCP_FORMS_REF.DCP_FORMS_REF_ID` |
| Open existing PowerForm | `activityId` | `DCP_FORMS_ACTIVITY.DCP_FORMS_ACTIVITY_ID` (0 = new) |
| New DynDoc | `templateId` | `DD_REF_TEMPLATE.DD_REF_TEMPLATE_ID` |
| DynDoc note type | `noteTypeCd` | code set 72 (0 ⇒ by-template call, non-zero ⇒ by-template-and-note-type) |
| Open chart tab | tab name | PowerChart tab caption, e.g. "Provider View" |
| View result/event | `eventId` | one id or an array |

## Server-backed lookups (prior-art contract)

For coded answers and provider search against large lists, the vendor's
pickers follow one pattern worth copying in a lookup custom script:

- **Count first, refuse above a limit** (default 100): reply with an error
  flag and an "N records, limit X" message instead of a giant list.
- **Hydrate saved values by key list**, replying `data: [{ key, value }]`;
  "All" is `-1`.
- Code-set searches filter on CDF meaning, display, display key,
  description, definition, CKI or concept CKI — fixed fields, not raw CCL.
- Personnel search can be limited to physicians; a location tree cascades
  facility → unit → room → bed; patient search runs over alias code sets
  4 and 319.

## Domain naming and content root

The vendor template's runtime config points at
`http://<host>/discern/<domain>/mpages/reports`, with domains named
`b1234` / `c1234` / `p1234` — **b**uild, **c**ert, **p**rod on one numeric
site id. Worth matching when we write our own per-domain config, and worth
recognising in a customer's config file.

Two smaller facts from the same source: PowerChart's WebView2 is evergreen
Chromium (that template targets ES2022 with `zone.js` as its only polyfill,
no differential loading), so our player can target modern output without
hedging; and its date adapter formats `dd-MMM-yyyy`, which is what PowerChart
shows and what the `hosts/powerchart` emulator now uses throughout.
