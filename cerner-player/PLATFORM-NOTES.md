# Cerner MPage platform notes

What the MPage platform provides, what it expects of us, and which pieces we
had to build ourselves. Companion to `DEPLOYMENT.md` (procedure),
`EXPORT-SHAPE.md` (what the builder's Cerner export contains, channel by
channel), `MPAGE-SURVEY.md` (what ten production MPages actually do with all
this), and `../cerner-ccl/PAYLOAD-REFERENCE.md` (server payload vocabulary).

## Where an MPage can run

Four hosting modes, all reachable with the same artifact:

| Mode | Patient context | Notes |
|---|---|---|
| Chart-level full page | current chart | our primary target |
| Organizer-level full page | none (`ORGANIZER` mode sends `0,0`) | worklists, dashboards |
| Workflow component | from the **host page's** query string | embedded card in a Workflow MPage |
| DA2 / Discern Web Services / plain browser | whatever you pass | our dev loop and the SMART path |

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
