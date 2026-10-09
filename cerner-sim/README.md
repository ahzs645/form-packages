# @webforms/cerner-sim — a simulated Cerner Millennium backend

Lets real MPages run without a Cerner domain. It answers the calls an MPage
makes — `XMLCclRequest` inside PowerChart, and Discern Web Services outside it —
from a synthetic chart, through CCL programs that reply the way the real ones
do. The PowerChart emulator (`/tutorial/host/powerchart/?fixture=mpage`, Portal
MPage) uses it for every page it hosts.

Clean-room: behaviour was taken from written specifications (`SPEC.md`, our
`packages/cerner-ccl` contract, the vendors' public documentation), never from
vendor source.

## Pieces

| Path | What it is |
|---|---|
| `src/db/` | The synthetic Millennium domain: tables (`types.ts`), code-value lookups (`db.ts`), and `seedMillenniumDb(roster)`, which builds persons, aliases (MRN, PHN with health-card fields), names, addresses, phones, an encounter with FIN and attending, census rows, allergies, a diagnosis and a problem per chart. |
| `src/ccl/` | Prompt-line parsing (`^MINE^`, `'MINE'`, bare values, `true`/`false`), PowerChart's `$PAT_PersonId$`-style substitution, and CCL value formats (`CCL_ZERO_DATE`, camel-case and classic upper-case `cnvtrectojson`, `cnvtrawhex`). |
| `src/simulator.ts` | `createCernerSimulator`: program registry, dispatch, the call log the inspector reads (decoded request and reply, notices), and Discern's missing-program answer (200 + a PDF error report). |
| `src/co5/` | Clinical Office v5: `1co5_mpage_entry` and its eight domain scripts, the custom-script services (dm_info, ref_data, setup `init`, component lookup, searches, census/encounter lists, patient search, documents), and `1co5_mpage_redirect` / `1co5_mpage_component`. |
| `src/nh/` | Our own `nh_wf_entry` (packages/cerner-ccl): whitelist, entitlement checks, `nh_wf_form_store`, `nh_wf_write_document`. |
| `src/classic/` | Single-purpose programs in the classic `_memory_reply_string = cnvtrectojson(rec)` form, used by the starter templates. |
| `src/transport/` | `createSimXmlCclRequest` (async and synchronous, the documented statuses, the 65,535-character limit), `handleDiscernWebRequest` (`/cclproxy/<prog>`, `…/mpages/reports/<prog>`, unencoded or url-encoded `parameters`/`blobIn`, hex in and out, the services-directory lookup), and `installDiscernWebIntercept`, which answers those URLs inside a page's own `fetch`/`XMLHttpRequest`, so no server route is needed. |

## Using it

```ts
import { createStandardSimulator, createSimXmlCclRequest } from "@webforms/cerner-sim";

const sim = createStandardSimulator({ roster });           // every built-in program
const XMLCclRequest = createSimXmlCclRequest(sim, { context: () => ({ personId, encntrId }) });
sim.subscribe((call) => console.log(call.program, call.status, call.notices));
```

Add a program the page needs:

```ts
sim.register({
  name: "my_site_program",
  description: "What it answers",
  program: (ctx) => ({ status: 200, body: classicRecordJson("REPLY", { STATUS: "S" }) }),
});
```

## Faithfulness

`QUIRKS.md` lists every place the simulator knowingly differs from
production (correct data, same shapes) and what the inspector says when a
page hits one. `src/__fixtures__/co5-setup-app.contract.json` records what the
Clinical Office setup app sends and reads, call by call; the test suite
replays it, so the simulator keeps satisfying that app without its code
being in the repository.

## Vendor apps

Unlicensed vendor MPages (for example the Clinical Office setup app) are not
committed. Copy a built app folder into the repository's git-ignored
`local-mpages/<name>/`; the development server lists it in the emulator's
MPage picker and serves it with the host bootstrap injected, and its
`config.json` pointed at the simulated web services (`lib/local-mpages.ts`).
