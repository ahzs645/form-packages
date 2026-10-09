# cerner-ccl — server side of the Cerner MPage target

Clean-room CCL implementing the entry-script contract that
`@webforms/cerner-core`'s `CclClient` speaks. Written from the wire protocol
as observed (blob request, positional prompts, spliced JSON reply); contains
no vendor code and adds two things the vendor design lacks: a **custom-script
whitelist** and **person/encounter entitlement checks**.

> **Status: written blind — not yet compiled in any Millennium domain.**
> Every script carries `!! SITE REVIEW` markers on the spots that must be
> confirmed in Discern Visual Developer before first compile (most
> importantly the `mmf_publish_ce` request record layout). Review with the
> interface/apps team (Vince/Joe) before deploying.

## Scripts

| Script | Purpose |
|---|---|
| `nh_wf_entry.prg` | Entry point (`nh_wf_entry:group1`): parses the JSON blob (hex or raw), resolves chart context (PowerChart macro substitution arrives in the prompts), enforces entitlement, serves the person/encounter prefill sections, dispatches whitelisted custom scripts, splices the JSON reply. |
| `nh_wf_write_document.prg` | Custom script: files a completed form into the chart as a clinical document via `mmf_publish_ce` (event key = code set 72 display key, note format = code set 23 meaning). |
| `nh_wf_form_store.prg` | Custom script: chunked read/write/inactivate/delete store for form definitions, drafts, and submission markers on `cust_nh_wf_reference` (32,000-char pieces keyed by `sequence`). |
| `nh_wf_tables.prg` | One-time DDL: `cust_nh_wf_reference` table + `cust_nh_wf_ref_seq` sequence. Application servers must be cycled after running it (confirm which with the DBA — commonly 58/79/178/179). |
| `nh_wf_custom_template.prg` | Starting point for future custom scripts (parameter access, patient_source contract, `add_custom_output`). |

## Wire contract (must match `cerner-core`)

- Prompts: `"MINE", PERSON_ID, ENCNTR_ID, DEBUG_IND, ID, ^CONFIG^` where
  `CONFIG` is `{"mode":"CHART|ORGANIZER","hexMode":true|false}`. Unknown
  chart context arrives as PowerChart's `$PAT_PersonId$`/`$VIS_EncntrId$`
  macros — already substituted before CCL sees the prompts.
- Request payload rides the blob (`REQUEST->BLOB_IN`), hex-encoded when
  `hexMode` (the off-PowerChart POST path).
- Whole-number `*Id`/`*Cd` values arrive as `123.0` floats so
  `CNVTJSONTOREC` types them f8.
- Reply: `{ runStats, chartId, errors, [persons], [encounters],
  [customPre], [customPost] }`, camelCase via `CNVTRECTOJSON(rec, 4, 1)`,
  hex-encoded back when `hexMode`. The client strips control chars 0x00-0x1F
  before parsing, so nothing here may rely on literal newlines in JSON
  string values.
- The trusted identity is always `REQINFO->UPDT_ID`; the client-supplied
  prsnl slot is ignored by design.

## Security posture (differs from the vendor design on purpose)

1. **Whitelist**: `nh_wf_entry` executes only custom-script names listed in
   `cWHITELIST`. Add new scripts there deliberately; unknown names return an
   error instead of executing.
2. **Entitlement**: every `patientSource` entry is validated — the person
   must exist and the encounter must belong to that person — before any
   section runs. The org-relationship check (`prsnl_org_reltn` overlap) is
   stubbed with a site hook; enable it per NH policy.

## Deploy runbook

1. Run `nh_wf_tables.prg` once per domain (DBA; cycle app servers after).
2. Compile the other four `.prg` in Discern Visual Developer
   (build → cert → prod per NH process).
3. Point the player/shell at `nh_wf_entry:group1` (already the
   `CclClient` default in the webforms player).
4. Dev loop from outside PowerChart: discover the Discern Web Services
   contextRoot (services-directory `urn:cerner:api:mpages` link + `reports`)
   and set it as the Vite `/cclproxy` target.

## First-compile checklist

Things only a real domain can answer. Settle each in DVDev/back-end CCL
before the scripts go past build:

1. **Unicode round trip.** The client sends non-ASCII as `\uXXXX` escapes.
   Write a `refText` containing a smart quote, an em dash and an accented
   name through `nh_wf_form_store`, read it back, and compare. If it does
   not round-trip, fold on the client before writing (smart quotes → ASCII,
   as prior art does) instead of storing mangled text.
2. **Health card columns.** Confirm the `PERSON_ALIAS` health-card columns
   `nh_wf_entry` reads, and which alias type NH stores the PHN under.
3. **List typing.** Send `{"eventIds":[123456789012.0]}` and check the
   record types the element f8.
4. The `!! SITE REVIEW` markers in each script.

## Running and debugging

- **Run setup or report output from DA2 or `discernoutputviewertester.exe`,
  not Discern Visual Developer.** DVDev still renders output through
  Internet Explorer, so an Edge-only page fails there while working in
  PowerChart. A DA2 report that writes (to `dm_info` or our table) needs a
  write-capable server selected in its properties.
- **Replaying a request.** With `DEBUG_IND > 0`, `nh_wf_entry` writes the
  parsed request to `cclscratch:nh_wf_debug_<prsnl_id>.json` on the node
  that served it (`runStats.node`) and returns without running anything.
  Replay it from a back-end CCL session **on that same node**: load the
  file into `PAYLOAD` and execute the entry script with `DEBUG_IND = 0`.
- **Date formats cross a case boundary.** CCL date masks ignore case
  (`dd-mmm-yyyy;;d`); the browser's do not. Anything a script emits as a
  formatted date for the page should use `yyyy` (never two-digit years), `MM`
  or `MMM` months, `dd` days, `HH` hours, `mm` minutes, with no CCL
  modifiers such as `;;d` or `;;q`. Prefer sending `dq8` values through
  `CNVTRECTOJSON`, which emits ISO 8601, and formatting on the client.
