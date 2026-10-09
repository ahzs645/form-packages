# Where the simulator differs from production

Policy (decided 2026-10-09): **correct data, same shapes.** Every key, list
and nesting the production Clinical Office scripts emit is kept, in the same
order, but a field production leaves blank by mistake is filled correctly.
Where a quirk is *behaviour* a page could depend on (which flag is read, when
an entry is omitted), production behaviour is kept and the simulator raises a
notice instead. Notices appear in the emulator's call inspector against the
call that triggered them; quirk notices start "Differs from production".

| Code | Production behaviour | Simulator | Notice |
|---|---|---|---|
| `co5.encounter-nurse-unit-cd` | `encounters[].locNurseUnitCd` is always 0 while `locNurseUnit` is filled. | Filled with the nurse unit code. | — |
| `co5.allergy-unfilled-fields` | `substanceTypeMeaning`, `reactionClass(+Cd)`, `severity(+Cd)` are never filled. | Filled. | — |
| `co5.diagnosis-severity-class` | `severityClass` shows the classification display; `modSourceVocab` is blank. | `severityClass` is the severity class display. | — |
| `co5.apo-skip-json` / `co5.problem-skip-json` | apo and problem honour `diagnosis.skipJSON` instead of their own flag. | Each honours its own section's `skipJSON` (the documented behaviour). | — |
| `co5.apo-organization-needs-org-source` | Organizations load only when both `organization` and `orgSource` are sent. | Same. | Yes, when `organization` arrives without `orgSource`. |
| `co5.patient-source-filler` | Dropped `patientSource` rows leave `{personId:0, encntrId:0}` filler visits at the end of the list, which reach `encounters` as near-empty rows. | Rows are still dropped and re-sorted by person then encounter; no filler. | Yes. |
| `co5.clear-patient-source-placement` | Only a **top-level** `clearPatientSource` empties the patient source; the copy inside `customScript` (which the vendor docs also show, and the setup app sends) is ignored. | Same. | Yes, whenever the flag is inside `customScript`. |
| `co5.errors-collection` | Errors are collected only inside the custom-script loops and inserted without JSON escaping (a quote corrupts the reply). | Collected the same way; always valid JSON. | — |
| `co5.dm-info-no-match` | `1co5_mpage_dm_info` emits **no** `{id, data}` entry when nothing matched. | Same. | Info notice. |
| `co5.ref-data-write-reply` | `ref_data` writes answer `{action:"w", data:[]}`. | Same. | — |
| `co5.enc-list-220-facility` | `enc_list` applies a code set 220 typeList to the encounter's **facility**, though the docs call it nurse unit. | Filters nurse unit, as documented. | Yes. |
| `co5.diagnosis-zero-encounter` | A visit with `encntrId` 0 returns every encounter-less diagnosis in the domain, for any person. | Restricted to that visit's person. | Yes. |
| `co5.custom-script-whitelist` | `customScript.name` is executed verbatim: any program, with prompt arguments. | Only implemented scripts run; an unknown name returns an error entry (`%CCL-E-18-PRG_NOT_FOUND`) and a warning. Prompt arguments after the name are still parsed. | Yes. |
| `co5.code-value-filter` | `codeValue[].filter` is raw CCL spliced into a `where` clause. | Only `CV.<column> = "value"` filters are applied. | Yes. |

## Simulator limits (not production quirks)

- **Synthetic chart.** Persons, encounters, aliases, addresses, phones,
  allergies, one diagnosis per visit and a hypertension problem for adults
  are generated from the emulator roster. Health plans, person/encounter
  info, relationships beyond the attending/PCP, credentials, prsnl groups and
  event-set hierarchies are empty lists.
- **Dates** are emitted in UTC (`+00:00`); a real domain uses its own offset.
- **`reference: true`** returns the blank-row shapes and a short `refCodeSet`
  rather than the full data-dictionary listing.
- **Phone formatting** applies North American formatting regardless of
  `phone.phoneOption`.
- **Legacy IE bridge** (`javascript:XMLCCLREQUEST_Send(…)` navigation with
  `XMLCCLREQUESTOBJECTPOINTER`) is not emulated; pages that ship that shim
  get the "defines its own XMLCclRequest" warning.
- **SMART-in-PowerChart (xfc)** host messages are not emulated.
