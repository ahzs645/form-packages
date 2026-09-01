# Cerner MPage platform notes

What the MPage platform provides, what it expects of us, and which pieces we
had to build ourselves. Companion to `DEPLOYMENT.md` (procedure),
`MPAGE-SURVEY.md` (what ten production MPages actually do with all this), and
`../cerner-ccl/PAYLOAD-REFERENCE.md` (server payload vocabulary).

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
