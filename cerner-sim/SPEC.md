# Clinical Office v5 CCL runtime — behaviour specification

> Written in our own words from a reading of the Clinical Office v5 CCL suite
> (`clinical-office-mpage-suite-ccl-5`, all-rights-reserved) and the vendor's
> public MPage Developer documentation. **No vendor source is reproduced.** This
> is the specification `src/co5/` implements; deliberate differences are in
> `QUIRKS.md`. Confidence tags: **[S]** read from the script logic, **[D]** vendor
> docs, **[I]** inferred CCL runtime behaviour to confirm against a real capture.

## 0. Inventory, grouped by role

| Role | Scripts |
| --- | --- |
| Dispatcher (the only script MPages call directly via XMLCclRequest) | `1co5_mpage_entry` |
| Domain scripts (run by the entry when a payload key is present) | `1co5_mpage_cvlookup` (`codeValue`), `1co5_mpage_encounter` (`encounter`), `1co5_mpage_person` (`person`), `1co5_mpage_prsnl` (`prsnl`), `1co5_mpage_apo` (`organization` / `address` / `phone`), `1co5_mpage_allergy` (`allergy`), `1co5_mpage_diagnosis` (`diagnosis`), `1co5_mpage_problem` (`problem`) |
| Custom-script services (named in `payload.customScript.script[].name`) | `1co5_ping`, `1co5_mpage_dm_info`, `1co5_mpage_ref_data` (+ library `1co5_mpage_ref_data_lib`), `1co5_mpage_setup` (`init` action), `1co5_embedded_workflow_comp`, `1co5_code_value_search`, `1co5_prsnl_search`, `1co5_event_set_search`, `1co5_location_search`, `1co5_location_tree` (+ library `1co5_location_routines`), `1co5_enc_search`, `1co5_enc_search_data`, `1co5_mpage_census_list`, `1co5_mpage_enc_list`, `1co5_load_document` (+ library `1co5_convert_blob`), `1co5_write_document`, `1co5_get_patient_list` (prompt-driven helper) |
| Templates (skeletons with placeholders; not runnable as shipped) | `1co5_mpage_template`, `1co5_mpage_select_template` |
| Standalone / prefmaint-launched | `1co5_mpage_redirect` (Discern Report tab → HTML redirect or component JSON), `1co5_mpage_component` (component path lookup; also called by the embedded workflow script), `1co5_mpage_setup` when run standalone (redirects to the setup app) |
| Back-end/dev tooling | `1co5_mpage_test` (replays a saved debug blob through the entry), `1co5_custom_tables` (DDL for `CUST_CO_REFERENCE`) |

---

## 1. Global conventions every response obeys

### 1.1 Request envelope
- XMLCclRequest target: `1co5_mpage_entry:group1`. Body (blob) is a JSON document whose **top-level key must be
  `payload`**: `{"payload": {...}}`. The CCL parser turns it into a record named after that key; the entry checks that a
  record called `payload` exists. Anything else → `runStats.status = "ERROR: Invalid Payload"` [S].
- Prompt line (6 slots): `outdev, personId, encntrId, debugInd, id, config` — see §2.1.
- Key matching on the CCL side is **case-insensitive** (CCL record field access ignores case), so `patientSource`,
  `patientsource`, `PATIENTSOURCE` are equivalent. The simulator should match payload keys case-insensitively [I].
- JSON booleans arrive as integers 1/0; the scripts test flags with "is present and equals 1" (`validate(x,0)=1`).
  A flag sent as `false` is therefore "off"; a flag that is an **object** (e.g. `address: {skipJSON:true}`) still counts
  as "present" for the entry's dispatch tests, which only check existence [S/I].
- Numbers: ids/codes are f8 server-side. The client's replacer sends whole-number `*Id`/`*Cd`/`*Float` values as
  floats (`123.0`) so the parser types them f8 (docs). The simulator just reads them as JS numbers.
- Dates in custom parameters are sent as ISO strings, e.g. `2018-05-07T14:44:51.000+00:00` (template comment + docs).
  If two custom scripts in one payload use the same parameter name with different JSON types, the real parser errors
  (the whole payload shares one record) — a simulator may ignore this, but should not rely on it.

### 1.2 Response serialisation
- Every structured output is produced by serialising a CCL record with "JSON, camelCase" options. Field names are
  converted by lower-casing and turning `_x` into `X`: `name_full_formatted → nameFullFormatted`,
  `street_addr2 → streetAddr2`, `life_rsv_daily_ded_qual_cd → lifeRsvDailyDedQualCd`, `DM_INFO → dmInfo`. The
  wrapper (record name) is camelCased too [S/D].
- **Splicing rule** used by the entry for domain scripts ("standard output"): the serialised record looks like
  `{"<recName>":{ <members> }}`; the entry drops the record-name wrapper and appends the members directly into the
  top-level reply. So a record whose single member is the list `persons` contributes the top-level key `"persons":[...]`;
  a record with several members contributes several top-level keys [S].
- **Custom output rule** (`add_custom_output`): inside the `customPre`/`customPost` arrays each entry is
  `{"id":"<script id>","data":{ <members of the record> }}` — the wrapper is replaced by `data`. It is only emitted
  when the script entry's `id` is non-blank (an empty/missing id = run for side effects, no output) [S].
- Field order inside objects = record definition order (use the field lists in this doc, in order) [I].
- Dates (dq8): ISO-8601 with milliseconds and numeric offset, e.g. `1980-01-01T08:00:00.000+00:00` [I/D — the client's
  date detector accepts `YYYY-MM-DDTHH:MM:SS(.fff)(Z|±HH:MM)`; clients auto-convert keys ending in `DtTm`/`Date`].
  Unset dates come out as the CCL "zero date"; **confirm the exact zero-date string from one real capture** before
  hard-coding it (likely `0000-00-00T00:00:00.000+00:00`) [I].
- Empty lists serialise as `[]` [I]. Strings are never null — unset `vc` fields are `""`; unset numbers are `0`.
- Multi-line text: the allergy/problem comment fields strip CR and replace LF with a backslash-n sequence before
  serialising [S]; the client strips control chars from replies anyway (memory note), so never emit raw newlines.

### 1.3 Shared in-memory state during one entry run
| Structure | Shape | Who fills it | Who reads it |
| --- | --- | --- | --- |
| `patient_source.visits[]` | `{personId, encntrId}` | entry (from payload/prompt), pre custom scripts (enc_search, census_list, enc_list, get_patient_list), encounter/person extended loading (patients only) | encounter, diagnosis, write_document, enc_search_data |
| `patient_source.patients[]` | `{personId}` | same as above | person, allergy, problem, apo (as PERSON parent values), enc_search_data |
| `prsnl_source.data[]` | `{personId}` | `add_prsnl` (person.prsnlReltn always; encounter/person/prsnl extended loading; `payload.prsnlSource`) | prsnl |
| `parent_values.data[]` | `{parentEntityId, parentEntityName}` (`PERSON`/`ORGANIZATION`) | `add_prsnl` (adds PERSON), `add_organization`, apo (adds every patient as PERSON, and `orgSource` as ORGANIZATION) | apo (address/phone/organization) |
| `ref_code_set.refCodeSet[]` | `{objectName, columnName, description, codeSet}` | domain scripts and templates in reference mode | entry emits at the very end |

Add-helpers de-duplicate (`add_person_to_patient_source` by personId; `add_prsnl` by personId and ignores 0;
`add_parent_value` by (id, name)) [S]. Note `add_organization(0)` is **not** filtered — org 0 can be added [S].

### 1.4 `typeList` filtering (shared by all domain scripts)
`payload.typeList = [{codeSet, type, typeCd}, ...]` applies globally to every script in the run. For a script filtering
column X against code set S [S]:
1. Collect code values from typeList entries whose `codeSet == S`:
   - `typeCd`: taken as-is if that code value exists (no active/end-date check on this branch);
   - `type`: matches code values **in code set S** that are active, not end-dated, > 0, and whose non-blank
     `cdf_meaning` equals `type`, **or** whose `display_key` equals `type` (exact, so send uppercase keys like `MRN`,
     `FIN NBR`, `HOME`).
2. If at least one code value was collected → filter `X IN (those values)`. If none → **no filter at all** (an
   unmatched type silently means "everything").
Code sets used: person alias 4, person reltn type 351, name type 213, person-prsnl reltn 331, person-org reltn 338,
person/encounter info **sub-type** 356, encounter alias 319, encounter-prsnl reltn 333, org alias 334, address type 212,
phone type 43, allergy reaction status 12025, allergy substance type 12020, diagnosis type 17, nomenclature
vocabulary 400 (diagnosis and problem), problem life-cycle status 12030, census/enc-list filters 69/220/19/71/34.

### 1.5 Reference mode (`payload.reference: true`)
Sets `runStats.referenceInd = 1`. Each domain script that supports it then **skips all data access**, emits its record
with exactly one blank row in every list (and one blank row in every nested list), and appends code-set metadata to
`refCodeSet` from the data dictionary (`dm_columns_doc`: every column of the listed tables with a non-zero code set).
`columnName` is the camelCased column name; `objectName` per script: `persons`, `encounters`, `prsnl`,
`organization`/`address`/`phone`, **`allergy`** (singular, although the reply key is `allergies`), `diagnosis`,
`problem`; custom template scripts use their own script `id` [S]. `cvlookup` has no reference branch (runs normally).
`refCodeSet` is spliced as a top-level key **after** `customPost` and only when non-empty [S].

---

## 2. `1co5_mpage_entry` — end to end

### 2.1 Prompt slots
| # | Name | Meaning |
| --- | --- | --- |
| 1 | outdev | Always `MINE` from MPages; unused for logic. |
| 2 | personId | Chart person (PowerChart substitutes `$PAT_PersonId$`). |
| 3 | encntrId | Chart encounter. |
| 4 | debugInd | 1 = "record only": write the raw blob to `1co_debug_<userPrsnlId>.json` on the node, set `runStats.debugFile`, and **skip every domain and custom script** (reply carries only runStats/chartId/errors). (v3/v4 used this slot for the user id; v5 = debug flag.) |
| 5 | id | Echoed as `runStats.id` (the client's instance/queue id for routing the reply). |
| 6 | config | A JSON *fragment* (an object literal) wrapped server-side as `{"config": <fragment>}`. Fields read: `mode` (`"CHART"` / `"ORGANIZER"`), `hexMode` (1/0). Blank = no config record. |

### 2.2 Hex mode
If `config.hexMode == 1`: the request blob is a hex string of the JSON (decode before parsing), `runStats.hexMode = 1`,
and the **entire final reply** is hex-encoded (CCL raw→hex, uppercase hex digits [I]). Used off-PowerChart (Discern web
services). Otherwise plain JSON both ways [S].

### 2.3 Processing order [S]
1. Raise max string length; parse config; parse blob (hex-decoded if hexMode). If debugInd = 1, write the debug file.
2. `runStats`: `id`, `startTime = now`, `domain` (current Millennium domain name), `node` (server node), `prsnlId`
   (session user = request's update id). Look up the user in `PRSNL`: `prsnlName` (name_full_formatted),
   `positionCd`, `position` (display), `physicianInd`, `username`.
3. `customTables`: lower-cased names of Clinical Office custom tables that exist — only `cust_co_reference` is checked.
   Simulator: `["cust_co_reference"]` when the ref-data store is enabled, else `[]`.
4. If no `payload` record → status `"ERROR: Invalid Payload"`, jump to finalisation (chartId still all zero).
5. `chartId.personId/encntrId` = prompt values.
6. If `config.mode == "CHART"` **and** prompt encntrId == 0: look up `DM_INFO` row (domain `CLINICAL OFFICE`, name
   `DEVELOPER TEST VISIT`, `info_domain_id = user prsnlId`); its `info_number` is an encounter id. If that encounter and
   its person exist: chartId gets that person/encounter, the patient-source default (step 9) uses them, and
   `runStats.status = "Chart Level MPage with no encounter. Using testing value from dm_info: <patient name> (ENCNTR_ID: <id>)"`.
7. If `config.mode == "CHART"`: `chartId.nameFullFormatted` = PERSON name of chartId.personId (any active status).
   In any other mode it stays `""`.
8. `runStats.referenceInd = payload.reference` when present.
9. **patientSource → patient_source** (only if `payload.patientSource` exists):
   - Rows where both ids are 0 are dropped.
   - Each remaining row is inner-joined to `ENCOUNTER` on `encntrId` (Millennium has an encntr_id 0 "zero row", so a
     person-only row `{personId: X, encntrId: 0}` survives; a row with a non-existent encntrId is dropped).
   - personId = the payload personId if > 0, else the encounter's person_id (so `{personId:0, encntrId:E}` resolves the
     person).
   - Rows are processed **sorted by personId, then encntrId** (not payload order). `patients` = distinct personIds in that
     order; `visits` = every row in that order.
   - Quirk: `visits` is pre-sized to the payload array length and never trimmed, so if any rows were dropped the list
     ends with `{personId:0, encntrId:0}` filler rows (they flow into `encounters` output as near-empty rows).
10. If `visits` is still empty: one visit + one patient from chartId (if step 6 substituted) or from the prompt ids
    (which may be 0/0 in organizer mode → a patient with personId 0 is present).
11. If debugInd == 0:
    a. **Top-level** `payload.clearPatientSource == 1` → empty both patient_source lists. (A `clearPatientSource` placed
       *inside* `customScript` is **not** read by the entry; only `1co5_mpage_select_template` looks at it. The vendor
       docs show both placements.)
    b. PRE custom scripts (if `payload.customScript` exists) — §2.4.
    c. Domain scripts, fixed order, each only if its key exists: `codeValue` → `encounter` → `person` → `prsnl` →
       (`organization` or `address` or `phone`) → `allergy` → `diagnosis` → `problem`. Order matters: encounter's
       extended loading adds persons that person then loads; person/encounter add prsnl that prsnl then loads; all of
       them add parent values that apo then loads.
    d. POST custom scripts — §2.4.
    e. `refCodeSet` (if any rows).
12. Finalisation: `runStats.endTime = now`; build reply; hex-encode if hexMode.

### 2.4 Custom scripts (`payload.customScript.script[]`)
Entry shape `{name, id, run, parameters}` (some services also read `action`/`data` at this level — see dm_info vs
ref_data below). For each phase:
- The key `customPre` (PRE pass) or `customPost` (POST pass) is emitted **whenever `customScript.script` exists**,
  even if no script has that `run` value (→ `[]`).
- Scripts run in array order; a script runs when `run` matches the phase case-insensitively.
- The program is invoked by executing the literal text `execute <name> go`. **`name` may therefore carry prompt
  arguments** after the program name (this is how prompt-driven helpers such as `1co5_get_patient_list:group1 "<listId>"`
  can be used). There is **no whitelist** and no entitlement check — the simulator should resolve `name` to a
  registered handler and reject unknown names (return a CCL-style error entry instead of throwing).
- Inside the script, `nScript` = index of the current entry; parameters are read from
  `payload.customScript.script[nScript].parameters`.
- After each entry (whether or not it ran in this phase) pending CCL errors are drained into `errors` (§2.6).

### 2.5 Reply shape (plain JSON)
```
{
  "runStats": { "id", "startTime", "endTime", "status", "hexMode", "debugFile", "referenceInd", "domain", "node",
                "prsnlId", "prsnlName", "physicianInd", "positionCd", "position", "username", "customTables": [..] },
  "chartId":  { "personId", "encntrId", "nameFullFormatted" },
  "errors":   [ {"code": <int>, "message": "<text>"} ... ],          // always present, usually []
  "customPre":  [ {"id": "...", "data": {...}} ... ],               // only if customScript.script exists
  <domain keys in run order: codeValues, encounters, persons, prsnl, apoExecuted, address, phone, organization,
   allergies, diagnosis, problem>,
  "customPost": [ ... ],                                            // only if customScript.script exists
  "refCodeSet": [ ... ]                                             // only if reference rows were produced
}
```
Status codes: `runStats.status` is `""` on a normal run; only the two strings above are ever set by the entry.
`runStats.debugFile` is `""` unless debugInd = 1. A client known to require `errors: []`, `runStats.debugFile: ""` and
`referenceInd: 0` (memory note on the Patient Information Component) — always emit them.

### 2.6 Errors
`errors[]` collects `{code, message}` from the CCL error queue, drained only inside the custom-script loops. Hence:
domain-script errors surface only if a customScript block exists (drained on the first POST iteration); with no
customScript, errors are never reported. Messages are inserted without JSON escaping (a quote in a message would
corrupt the real reply) — the simulator should escape properly [S].

### 2.7 Licensing
**No licence check exists anywhere in this CCL suite** [S — grep for "licen" finds nothing]. Licensing in Clinical Office
is client-side: the npm token gates building, and the optional Angular `LicenseService` decrypts a key stored in
`config.json` or in custom data and compares its `domains` list/dates against the client's `MPage.domain` — which the
client takes from `runStats.domain` (docs). A simulator that wants licensed apps to pass should set `runStats.domain`
to a domain name the app's key covers; there is no "missing licence" reply shape on the server.

---

## 3. Domain scripts

All of these: exit silently (no output key at all) if their payload key is absent or the relevant patient_source list
is empty (noted per script). "Display" = code value display; "meaning" = cdf_meaning.

### 3.1 `1co5_mpage_cvlookup` — key `codeValue`
- Input: `payload.codeValue = [{cs, value, filter, alias, outboundAlias}]` (docs + script; the special-instructions
  header says `cv`, the script reads **`value`**).
  - `cs`: code set; `value`: a single code value; a row matches when it is in code set `cs` **or** equals `value`.
  - `filter`: a raw CCL boolean expression applied to the `code_value` row (blank → no filter). This is server-side code
    injection in the real system; simulator: support a tiny safe subset (e.g. `cv.cdf_meaning = "X"`,
    `cv.display_key = "X"`, `IN (...)`) or ignore.
  - `alias`: a contributor-source **display key** (string, e.g. `"HL7"`), not a boolean; `outboundAlias` likewise.
- Filters: active, not end-dated, code value ≠ 0, code set > 0. Each input entry's rows are sorted by `display_key` and
  appended in input order (no de-dup across entries).
- Alias resolution: for rows with a non-blank `alias`, read `CODE_VALUE_ALIAS` rows of that code value whose contributor
  source's display_key equals the upper-cased alias; when several, the primary one wins. Outbound similarly from
  `CODE_VALUE_OUTBOUND`.
- Output: top-level `codeValues` (only when ≥ 1 row): `{codeValue, codeSet, cdfMeaning, display, displayKey,
  description, definition, aliasInd, alias, outboundInd, outbound}` — `aliasInd`/`outboundInd` **echo the requested
  contributor-source strings** (not 0/1).

### 3.2 `1co5_mpage_encounter` — key `encounter` (needs ≥ 1 visit)
Options: `aliases`, `encounterInfo`, `encounterPlanReltn`, `personReltn`, `prsnlReltn`, `locHist`,
`loadExtendedPersons`, `skipJSON`.
- One output row per **visit** (same order, duplicates and zero filler rows kept). Core fields joined from `ENCOUNTER`
  + `LOCATION` (for `locationOrgId`); **no active-status filter on the encounter**; a missing encounter leaves the row
  with only `encntrId`.
- Output key `encounters`, row fields in order:
  `encntrId, personId, encntrClass, encntrType, encntrTypeClass, encntrStatus, preRegDtTm, preRegPrsnlId, regDtTm,
  regPrsnlId, estArriveDtTm, estDepartDtTm, arriveDtTm, departDtTm, admitType, admitSrc, admitMode, dischDisposition,
  dischToLoctn, readmit, accommodation, accommodationRequest, accommodationReason, ambulatoryCond, courtesy, isolation,
  medService, confidLevel, vip, location, locFacility, locBuilding, locNurseUnit, locRoom, locBed, dischDtTm,
  organizationId, reasonForVisit, encntrFinancialId, financialClass, trauma, triage, triageDtTm, visitorStatus,
  inpatientAdmitDtTm, encntrClassCd, encntrTypeCd, encntrTypeClassCd, encntrStatusCd, admitTypeCd, admitSrcCd,
  admitModeCd, dischDispositionCd, dischToLoctnCd, readmitCd, accommodationCd, accommodationRequestCd,
  accommodationReasonCd, ambulatoryCondCd, courtesyCd, isolationCd, medServiceCd, confidLevelCd, vipCd, locationCd,
  locationOrgId, locFacilityCd, locBuildingCd, locNurseUnitCd, locRoomCd, locBedCd, financialClassCd, traumaCd,
  triageCd, visitorStatusCd`, then nested lists `aliases, personReltn, prsnlReltn, encntrInfo, encntrPlanReltn,
  locHist` (always present, `[]` unless requested/found).
  - **Real-system bug:** `locNurseUnitCd` is never populated → always `0`, while `locNurseUnit` (display) is filled.
- `aliases` (ENCNTR_ALIAS, active, not end-dated, typeList 319): `aliasPool, aliasType, aliasTypeMeaning, alias,
  aliasFormatted (alias run through the pool's format mask), aliasSubType, aliasPoolCd, encntrAliasTypeCd,
  encntrAliasSubTypeCd`.
- `personReltn` (ENCNTR_PERSON_RELTN, active, not end-dated, typeList 351, joined to PERSON): `relatedPersonId,
  nameFullFormatted, personReltnType, personReltnTypeMeaning, personReltnTypeCd, personReltn, personReltnCd,
  relatedPersonReltn, relatedPersonReltnCd, contactRole, contactRoleCd, geneticRelationshipInd, livingWithInd,
  visitationAllowed, visitationAllowedCd, familyReltnSubType, familyReltnSubTypeCd, defaultReltnInd,
  copyCorrespondence, copyCorrespondenceCd, prioritySeq, internalSeq, relationSeq`.
- `prsnlReltn` (ENCNTR_PRSNL_RELTN, active, not end-dated, typeList 333, joined to PRSNL): `reltnType,
  reltnTypeMeaning, personId (prsnl), prioritySeq, internalSeq, prsnlType, nameFullFormatted, physicianInd, position,
  nameLast, nameFirst, userName, encntrPrsnlRCd, prsnlTypeCd, positionCd`.
- `encntrInfo` (ENCNTR_INFO, active, not end-dated, typeList **356 on info_sub_type**; LONG_TEXT outer): `infoType,
  infoTypeMeaning, infoSubType, infoSubTypeMeaning, valueNumericInd, valueNumeric (integer here), valueDtTm,
  chartableInd, prioritySeq, internalSeq, value (display of value_cd), longText, infoTypeCd, infoSubTypeCd, valueCd`.
- `encntrPlanReltn` (ENCNTR_PLAN_RELTN active + status ACTIVE + not end-dated, joined HEALTH_PLAN, LONG_TEXT outer;
  sorted by priority): `encntrPlanReltnId, personPlanReltnId, personId, healthPlanId, organizationId, prioritySeq,
  memberNbr (falls back to subscriber member nbr when blank), signatureOnFile(+Cd), balanceType(+Cd), deductAmt,
  deductMetAmt, deductMetDtTm, verifyStatus(+Cd), verifyDtTm, verifyPrsnlId, insuredCardName, groupName, groupNbr,
  policyNbr, memberPersonCode, lifeRsvDays, lifeRsvRemainDays, lifeRsvDailyDedAmt, lifeRsvDailyDedQual(+Cd),
  cardIssueNbr, cardCategory(+Cd), programStatus(+Cd), denialReason(+Cd), coverageComments, verifySource(+Cd),
  extPayerName, extPayerIdent, altMemberNbr, genericHealthPlanName, planType(+Cd), planClass(+Cd), planName, planDesc,
  financialClass(+Cd), babyCoverage(+Cd), combBabyBill(+Cd), serviceType(+Cd), planCategory(+Cd),
  priorityRankingNbr` (each `X(+Cd)` = display field immediately followed by its `XCd`, matching record order).
  Quirk: the real query is not directed to "nl:", so it also writes report output — irrelevant to the JSON.
- `locHist` (ENCNTR_LOC_HIST active only — no date filter; joined LOCATION): `begEffectiveDtTm, endEffectiveDtTm,
  arriveDtTm, arrivePrsnlId, departDtTm, departPrsnlId, location, locFacility, locBuilding, locNurseUnit, locRoom,
  locBed, encntrType, medService, transactionDtTm, activityDtTm, accommodation, accommodationRequest,
  accommodationReason, admitType, isolation, organizationId, encntrTypeClass, locationCd, locationOrgId,
  locFacilityCd, locBuildingCd, locNurseUnitCd, locRoomCd, locBedCd, encntrTypeCd, medServiceCd, accommodationCd,
  accommodationRequestCd, accommodationReasonCd, admitTypeCd, isolationCd, encntrTypeClassCd` (nurse unit cd is
  populated here).
- `loadExtendedPersons`: queues the encounter org, pre-reg/reg prsnl, every encounter-prsnl, plan org + verify prsnl +
  plan person (when different from the encounter's person), loc-hist org + location org + arrive/depart prsnl, and
  every encounter-related person (into `patient_source.patients`). These only produce output if `person`/`prsnl`/apo
  keys are also in the payload.
- Sub-list ordering: grouped by encounter; within a group DB order (simulator: insertion order).
- `encounter.skipJSON` → no output key (data still loaded so later custom scripts can use it).

### 3.3 `1co5_mpage_person` — key `person` (needs ≥ 1 patient)
Options: `aliases, names, personInfo, prsnlReltn, personReltn, personPlanReltn, personCodeReltn, orgReltn,
loadExtendedPersons, skipJSON`, plus undocumented-in-header **`patient`** (documented in vendor docs).
- One row per `patient_source.patients` entry, in that order. Core from PERSON (active, ACTIVE status, not end-dated) +
  PERSON_PATIENT outer (same filters). Inactive/missing persons keep only `personId`.
- Output key `persons`; row fields: `personId, logicalDomainId, nameFullFormatted, nameLast, nameFirst, nameMiddle,
  birthDtTm, age, deceasedDtTm, lastEncntrDtTm, autopsy, deceased, ethnicGrp, language, maritalType, race, religion,
  sex, species, confidLevel, vip, interpRequired, livingWill, gestAgeAtBirth, gestAgeMethod, healthInfoAccessOffered,
  autopsyCd, deceasedCd, ethnicGrpCd, languageCd, maritalTypeCd, raceCd, religionCd, sexCd, speciesCd, confidLevelCd,
  vipCd, interpRequiredCd, livingWillCd, gestAgeMethodCd, healthInfoAccessOfferedCd`, then lists `aliases, names,
  prsnlReltn, personReltn, personPlanReltn, personOrgReltn, personInfo, personCodeReltn`.
  - `age`: Cerner age text from birth date (e.g. `"45 Years"`, `"3 Months"`, `"12 Days"`).
  - The PERSON_PATIENT-derived fields (`interpRequired…healthInfoAccessOfferedCd`) are filled **only when
    `person.patient` is true**; otherwise blank/0.
- `aliases` (PERSON_ALIAS active, not end-dated, typeList 4): `aliasPool, aliasType, aliasTypeMeaning, alias,
  aliasFormatted, aliasSubType, visitSeqNbr, healthCardProvince, healthCardVerCode, healthCardIssueDtTm,
  healthCardExpiryDtTm, healthCardType, aliasPoolCd, personAliasTypeCd, personAliasSubTypeCd`.
- `names` (PERSON_NAME active, not end-dated, typeList 213; newest begin date first): `nameType, nameTypeMeaning,
  begEffectiveDtTm, endEffectiveDtTm, nameFullFormatted (from name_full), nameFirst, nameMiddle, nameLast, nameDegree,
  nameTitle, namePrefix, nameSuffix, nameInitials, nameTypeSeq, nameTypeCd`.
- `prsnlReltn` (PERSON_PRSNL_RELTN active, not end-dated, typeList 331, joined PRSNL): `reltnType, reltnTypeMeaning,
  personId (prsnl), prioritySeq, prsnlType, nameFullFormatted, physicianInd, position, nameLast, nameFirst, userName,
  personPrsnlRCd, prsnlTypeCd, positionCd`. **Always** queues each prsnl for the prsnl script and as a PERSON parent
  value (for address/phone), regardless of loadExtendedPersons.
- `personReltn` (PERSON_PERSON_RELTN active, not end-dated, typeList 351, joined PERSON of the related person): sorted
  by reltn type cd, priority, internal seq, newest begin first; one row per (type, priority, internalSeq) group:
  `personReltnType, personReltnTypeMeaning, personReltn, relatedPersonReltn, personId (related), prioritySeq,
  internalSeq, nameFullFormatted, nameLast, nameFirst, nameMiddle, personReltnTypeCd, personReltnCd,
  relatedPersonReltnCd`.
- `personPlanReltn` (PERSON_PLAN_RELTN active + ACTIVE + not end-dated, joined HEALTH_PLAN and subscriber PERSON, LONG_TEXT
  outer; by priority): `personPlanReltnId, healthPlanId, personPlanR, personPlanRCd, organizationId, prioritySeq,
  memberNbr, signatureOnFile, signatureOnFileCd, balanceType, balanceTypeCd, deductAmt, deductMetAmt, deductMetDtTm,
  coverageType, coverageTypeCd, maxOutPcktAmt, maxOutPcktDtTm, famDeductMetAmt, famDeductMetDtTm, verifyStatus,
  verifyStatusCd, verifyDtTm, verifyPrsnlId, insuredCardName, groupName, groupNbr, policyNbr, subscriberPersonName,
  subscriberPersonId, memberPersonCode, lifeRsvDays, lifeRsvRemainDays, lifeRsvDailyDedAmt, lifeRsvDailyDedQual,
  lifeRsvDailyDedQualCd, cardIssueNbr, cardCategory, cardCategoryCd, programStatus, programStatusCd, denialReason,
  denialReasonCd, coverageComments, contractCode, verifySource, verifySourceCd, extPayerName, extPayerIdent,
  altMemberNbr, genericHealthPlanName, planType, planTypeCd, planClass, planClassCd, planName, planDesc,
  financialClass, financialClassCd, babyCoverage, babyCoverageCd, combBabyBill, combBabyBillCd, serviceType,
  serviceTypeCd, planCategory, planCategoryCd, priorityRankingNbr` (note record order: `subscriberPersonName` before
  `subscriberPersonId`).
- `personOrgReltn` (option key **`orgReltn`**; PERSON_ORG_RELTN active, not end-dated, typeList 338, joined
  ORGANIZATION): `personOrgReltnId, personOrgReltn, personOrgReltnMeaning, organizationId, emplType, emplStatus,
  orgName (org name, or the free-text org name when organizationId = 0), prioritySeq, personOrgReltnCd, emplTypeCd,
  emplStatusCd`. Always queues the org as an ORGANIZATION parent value.
- `personInfo` (PERSON_INFO active + ACTIVE + not end-dated, typeList 356 on sub-type; outer joins to
  PERSON_CODE_VALUE_R rows whose code value equals the info's value_cd, and LONG_TEXT): `infoType, infoTypeMeaning,
  infoSubType, infoSubTypeMeaning, valueNumericInd, valueNumeric, valueDtTm, chartableInd, prioritySeq, internalSeq,
  value, longText, infoTypeCd, infoSubTypeCd, valueCd`. `value` = comma-joined displays of the matching
  person-code-value rows when any, else the display of value_cd.
- `personCodeReltn` (PERSON_CODE_VALUE_R active; sorted code set, display): `personCodeValueRId, codeSet, codeValue,
  display`.
- `loadExtendedPersons` = two passes: pass 1 walks `personReltn` (queues related persons as patients) and
  `personPlanReltn` (queues plan org, verify prsnl, subscriber person) without recording rows; the person list is then
  rebuilt from patient_source (now including the discovered people) and everything runs once more normally, so related
  people appear as **full rows in `persons`** (one level deep). Encounter's extended additions (it ran earlier) are
  included the same way.
- `person.skipJSON` → no output key.

### 3.4 `1co5_mpage_prsnl` — key `prsnl`
Options: `aliases, credential, prsnlGroup, orgReltn, prsnlPrsnlReltn, loadExtendedPersons, skipJSON`. Input ids:
`payload.prsnlSource = [{personId}]` plus everything already queued (§1.3). Does **not** need patients.
- Output key **`prsnl`** (singular, a list). One row per queued id, order = queue order. Core from PRSNL with **no
  active filter**: `personId, begEffectiveDtTm, endEffectiveDtTm, prsnlType, prsnlTypeCd, nameFullFormatted, email,
  physicianInd, position, positionCd, department, departmentCd, section, sectionCd, nameLast, nameFirst, username,
  primAssignLoc, primAssignLocCd, physicianStatus, physicianStatusCd, logicalDomainGrpId, logicalDomainId,
  externalInd`, lists `aliases, credential, prsnlGroup, prsnlPrsnlReltn, prsnlOrgReltn`.
- `aliases` (PRSNL_ALIAS active + ACTIVE + not end-dated; **no typeList**): `aliasPool, aliasPoolCd, prsnlAliasType,
  prsnlAliasTypeCd, alias, aliasFormatted, prsnlAliasSubType, prsnlAliasSubTypeCd`.
- `credential` (CREDENTIAL by prsnl_id, active + ACTIVE + not end-dated; sorted type cd, display seq): `credential,
  credentialCd, credentialType, credentialTypeCd, displaySeq, idNumber, renewalDtTm, state, stateCd, validFor,
  validForCd`.
- `prsnlGroup` (PRSNL_GROUP_RELTN + PRSNL_GROUP, both active + ACTIVE + not end-dated): `prsnlGroupId, prsnlGroupR,
  prsnlGroupRCd, prsnlGroupType, prsnlGroupTypeCd, prsnlGroupName, prsnlGroupDesc, serviceResource,
  serviceResourceCd, prsnlGroupClass, prsnlGroupClassCd`.
- `prsnlPrsnlReltn` (PRSNL_PRSNL_RELTN active + ACTIVE + not end-dated, joined related PRSNL): `prsnlPrsnlReltn,
  prsnlPrsnlReltnCd, relatedPersonId, relatedPersonName, relatedPersonPositionCd, relatedPersonPosition`.
- `prsnlOrgReltn` (option key `orgReltn`; PRSNL_ORG_RELTN active + ACTIVE + not end-dated, joined ORGANIZATION):
  `organizationId, confidLevel, confidLevelCd, orgName`; queues each org as a parent value.
- `loadExtendedPersons`: two-pass like person, using `prsnlPrsnlReltn` to pull related prsnl in as full rows.

### 3.5 `1co5_mpage_apo` — keys `organization` / `address` / `phone`
Inputs: any of `address`, `phone`, `organization` (`{aliases}`), `orgSource = [{organizationId}]`, `phone.phoneOption`
(integer passed to Cerner's phone formatter), typeList 212/43/334.
- Builds the parent list: every patient (PERSON) + `orgSource` (ORGANIZATION) + anything queued earlier (prsnl as
  PERSON, orgs as ORGANIZATION).
- **Organizations are loaded only when both `organization` and `orgSource` are present.** Then every ORGANIZATION parent
  (including ones queued by person/encounter/prsnl) that is active and not end-dated: `organizationId, orgName,
  federalTaxIdNbr, orgStatusCd, orgStatus, orgClassCd, orgClass, externalInd, aliases[]`; aliases (ORGANIZATION_ALIAS
  active, not end-dated, typeList 334) only with `organization.aliases`: `aliasPoolCd, aliasPool, orgAliasTypeCd,
  orgAliasType, orgAliasTypeMeaning, orgAliasSubTypeCd, orgAliasSubType, alias, aliasFormatted`.
- If the parent list is empty → **no apo keys at all**.
- `address` (only if requested; ADDRESS active, not end-dated, matching (id, name) parents; sorted parent id, parent
  name, type display, type seq): `parentEntityId, parentEntityName, addressId, addressTypeCd, addressType,
  addressTypeMeaning, addressTypeSeq, activeInd, begEffectiveDtTm, endEffectiveDtTm, streetAddr, streetAddr2,
  streetAddr3, streetAddr4, city, stateCd, state, zipCode, countyCd, county, countryCd, country` (state/county/country
  = code display when the code is non-zero, else the free-text column).
- `phone` (only if requested; PHONE active, not end-dated; same sort with phone type): `parentEntityId,
  parentEntityName, phoneId, phoneTypeCd, phoneType, phoneTypeMeaning, phoneTypeSeq, activeInd, begEffectiveDtTm,
  endEffectiveDtTm, phoneNumber (raw), phoneFormatted (digits only, then Cerner formatting by format code/option),
  extension`.
- Output keys (all four, spliced): `apoExecuted` (1; 0 in reference mode), `address`, `phone`, `organization` — all
  **singular** names, each a flat list across all parents; unrequested lists are `[]`. The client filters by
  `parentEntityId`/`parentEntityName`.
- Skip flag quirk: the script checks **`diagnosis.skipJSON`**, not `address.skipJSON` as the docs claim.

### 3.6 `1co5_mpage_allergy` — key `allergy` (needs patients)
Options: `reactions`, `comments`, `skipJSON`; typeList 12025 (reaction status) and 12020 (substance type).
- ALLERGY by patient person ids, active + not end-dated, joined NOMENCLATURE on substance (inner; no nomenclature row →
  allergy dropped; Millennium has a nomenclature 0 row so free-text allergies survive). Sorted by person, then
  upper-cased substance text.
- Output key `allergies` (omitted entirely when zero rows): `personId, encntrId, allergyId, allergyInstanceId,
  substance, substanceIdentifier, substanceFtDesc, substanceType, substanceTypeMeaning, reactionClass, severity,
  sourceOfInfo, sourceOfInfoFt, onsetDtTm, reactionStatus, createdDtTm, createdPrsnlId, cancelReason, cancelDtTm,
  cancelPrsnlId, verifiedStatusFlag, recSrcVocab, recSrcIdentifer (sic), recSrcString, onsetPrecision,
  onsetPrecisionFlag, reviewedDtTm, reviewedPrsnlId, origPrsnlId, reactionStatusDtTm, substanceTypeCd, reactionClassCd,
  severityCd, sourceOfInfoCd, reactionStatusCd, cancelReasonCd, recSrcVocabCd, onsetPrecisionCd, reaction[],
  comment[]`.
  - Never populated (always blank/0): `substanceTypeMeaning, reactionClass, severity, reactionClassCd, severityCd`.
    A faithful simulator emits them blank; consider an opt-in "fill" mode.
- `reaction[]` (singular key; REACTION active + not end-dated, joined NOMENCLATURE; by upper-cased text):
  `reaction, reactionIdentifier, reactionFtdesc`.
- `comment[]` (ALLERGY_COMMENT active + not end-dated; newest first): `commentDtTm, commentPrsnlId, allergyComment`.

### 3.7 `1co5_mpage_diagnosis` — key `diagnosis` (needs visits)
typeList 17 (diag type) and 400 (vocabulary of the primary nomenclature).
- DIAGNOSIS **by encounter id of each visit** (not person), active + not end-dated; inner joins to the diagnosis,
  modifier and originating NOMENCLATURE rows (0 rows exist in Millennium). No ordering.
  - Hazard: a visit with encntrId 0 matches every encounter-less diagnosis in the database for any person. A simulator
    should restrict by person as well, or reproduce deliberately.
- Output key `diagnosis` (omitted when zero rows): `personId, encntrId, diagnosisId, nomenclatureId, dxSourceString,
  dxSourceIdentifier, dxSourceVocab, diagDtTm, diagType, diagnosticCategory, diagPriority, diagPrsnlId, diagPrsnlName,
  diagClass, confidLevel, attestationDtTm, diagFtdesc, modNomenclatureId, modSourceString, modSourceIdentifier,
  modSourceVocab, diagNote, conditionQual, clinicalService, confirmationStatus, classification, severityClass,
  certainty, probability, diagnosisDisplay, severityFtdesc, longBlobId, ranking, severity, diagnosisGroup,
  clinicalDiagPriority, presentOnAdmit, hacInd, laterality, originatingNomenclatureId, origDxSourceString,
  origDxSourceIdentifier, origDxSourceVocab, diagTypeCd, dxSourceVocabCd, diagnosticCategoryCd, diagClassCd,
  confidLevelCd, modSourceVocabCd, conditionalQualCd, clinicalServiceCd, confirmationStatusCd, classificationCd,
  severityClassCd, certaintyCd, rankingCd, severityCd, presentOnAdmitCd, lateralityCd, origDxSourceVocabCd`.
  - Real-system bugs: `modSourceVocab` (display) never set; `severityClass` shows the **classification** display.

### 3.8 `1co5_mpage_problem` — key `problem` (needs patients)
Option `comments`; typeList 12030 (life cycle status) and 400 (vocabulary).
- PROBLEM by person, active + not end-dated, joined primary and originating NOMENCLATURE; sorted by person then
  upper-cased annotated display.
- Output key **`problem`** (singular list; omitted when zero rows). Mostly codes, no displays: `personId,
  problemInstanceId, problemId, nomenclatureId, probSourceString, probSourceIdentifier, probSourceVocabCd,
  problemFtdesc, estimatedResolutionDtTm, actualResolutionDtTm, classificationCd, persistenceCd,
  confirmationStatusCd, lifeCycleStatusCd, lifeCycleDtTm, onsetDtCd, onsetDtTm, rankingCd, certaintyCd, probability,
  personAwareCd, prognosisCd, personAwarePrognosisCd, familyAwareCd, sensitivity, courseCd, cancelReasonCd,
  onsetDtFlag, statusUpdtPrecisionCd, statusUpdtFlag, statusUpdtDtTm, qualifierCd, annotatedDisplay,
  severityClassCd, severityCd, severityFtdesc, lifeCycleDtCd, lifeCycleDtFlag, problemTypeFlag, lateralityCd,
  originatingNomenclatureId, origProbSourceString, origProbSourceIdentifier, origProbSourceVocabCd, comment[]`.
- `comment[]` (PROBLEM_COMMENT active + not end-dated, newest first): `commentDtTm, commentPrsnlId, problemComment`.
- Skip flag quirk: checks **`diagnosis.skipJSON`**.

---

## 4. Custom-script services (output = one `{id, data}` entry in customPre/customPost)

### 4.1 `1co5_ping`
`data = {"ping": 0}` (the field is never set) [S]. Used as a connectivity test.

### 4.2 `1co5_mpage_dm_info` — generic key/value store
Parameters: `action` (first letter, upper-cased: R / W / D), `data = [{infoDomain, infoName, infoDate, infoChar,
infoNumber, infoLongText, infoDomainId}]` (docs: `IDmInfoActions {id, action, data}` — the CCL reads them under
`parameters`).
- Key = (infoDomain, infoName, infoDomainId). Matching per data item:
  - Read: domain must match; blank `infoName` = any name; `infoDomainId` 0 = any id.
  - Write/Delete: exact match on all three.
- Read → one row per matching DM_INFO row, `actionStatus "READ"`, `longText` loaded from LONG_TEXT (parent
  `DM_INFO`, active).
- Write → **upsert**: no row → INSERT (`updtId` = user, `updtDtTm` = now; a LONG_TEXT row is created only if
  `infoLongText` non-blank); existing row → UPDATE of date/char/number/text, keeping the existing long-text id (a row
  that never had long text cannot gain one via update; an existing text is overwritten, even with blank).
- Delete → removes the DM_INFO row; its LONG_TEXT is inactivated, not deleted.
- Output `data = {"dmInfo":[{infoDomain, infoName, infoDate, infoChar, infoNumber, longTextId, longText, updtDtTm,
  updtId, infoDomainId, actionStatus}]}` where `actionStatus ∈ READ|INSERT|UPDATE|DELETE`. For write rows the values
  echo the request (dates as sent; `updtDtTm` = now).
- **Edge:** if nothing matched (e.g. a read with no rows, delete of a missing key) the script exits **without
  emitting any entry** for that id — the client gets no `{id}` object at all, not an empty list.
- Writes commit immediately.

### 4.3 `1co5_mpage_ref_data` (+ `_lib`) — `CUST_CO_REFERENCE` store
- **Wire placement differs from dm_info:** `action` and `data` are read from the **script entry itself**
  (`customScript.script[n].action` / `.data`), not from `parameters` (the header comment shows `parameters`; the code
  and the docs' `ICustomReferenceActions {id, action, data}` agree on entry level). Both must be present or nothing
  happens.
- `action` lower-cased: `r` read active, `ra` read including inactive, `w` write, `i` inactivate, `d` delete.
- `data[] = {refName, refTask?, description?, parentEntityId?, parentEntityName?, refText?}`. Missing `refTask` →
  reads ignore task (any task); writes/deletes use task `""`. Parent scoping applies only when **both** parent fields
  are present; otherwise reads ignore parent, writes store 0/"" and update/delete/inactivate match 0/"".
- Storage model: a logical value = rows sharing (refName, refTask, parent, create time) with `sequence` 1..n, each
  `refText` chunk ≤ 32,000 chars; `endEffectiveDtTm` = 2100-12-31 23:59:59 on insert.
- Read (`r`/`ra`): per input item, rows grouped by (active desc, create time desc) — each group becomes one output row
  whose `refText` is the chunks concatenated in sequence order. Quirk: each accumulated chunk is right-trimmed before
  the next is appended, so whitespace at a 32,000-char boundary is lost. Output row: `refName, refTask, description,
  parentEntityId, parentEntityName, refText, createPrsnlId, createPrsnlName, activeInd, updtId, updtName, updtDtTm,
  begEffectiveDtTm, endEffectiveDtTm`. (The client interface also lists `createDtTm` and boolean `activeInd`; the CCL
  emits no `createDtTm` and an integer `activeInd`.)
- Write (`w`): first counts existing active chunks for the key (keeps original creator/create time); splits new text
  into ceil(len/32000) chunks (minimum 1, even for empty text); deletes surplus old chunks; updates existing sequence
  numbers in place (description + text + updt fields); inserts new ones. Output rows: **none** — `data = {"action":"w",
  "data":[]}`.
- Inactivate (`i`): sets inactive + end date now on all active rows of the key. Delete (`d`): hard-deletes active rows.
  Output `{"action":"i"|"d","data":[]}`.
- No action/data → `{"action":"","data":[]}`.
- Library quirk: the library script ends with a conditional extra output call; whether it fires depends on CCL
  `validate()` of a subroutine name (almost certainly false). Simulator: emit exactly one entry.

### 4.4 `1co5_mpage_setup` (custom-script mode; `parameters.action = "init"`)
- Without `parameters.action` → no output. Unknown action → `data = {"statusCode": 0}`.
- `init` → `data = {components:[...], managerUrl, host:{domain, zone, fullCanonicalDomainName, serviceDirectoryUrl}}`:
  - `components`: (a) labels of Bedrock MPage components registered as Clinical Office components (filters
    `CUSTOM_COMP_PRG*` whose value has free-text `clinical_office.mpage_component`, paired with the matching
    `CUSTOM_COMP_*` filter's `mp_label` value), sorted by label, each `{inBedrockId:1, mappedId:0, label, path:"",
    mappingStatus:"Not Mapped.", lastUpdateDtTm, updtId, mappingLastUpdatedBy}`; then (b) every DM_INFO row in domain
    `Clinical Office Component` (info_name = label, info_char = path/URL): matching labels get `mappedId:1`,
    `path`, `lastUpdateDtTm`, `updtId`, `mappingLastUpdatedBy` (prsnl name), `mappingStatus "Mapping Completed."`;
    unmatched DM_INFO rows are appended with `inBedrockId:0` and `"No longer exists in Bedrock, please delete."`.
  - `managerUrl` = DM_INFO `INS`/`CONTENT_SERVICE_URL` value + `/manager`.
  - `host`: domain = environment name (lower case); zone/FQDN/service-directory URL come from DNS SRV lookups
    (`_cerner_<domain>_mqclient._tcp`, then `_cerner_svcdirssl…`/`_cerner_svcdir…` → `https://`/`http://`). Simulator:
    static values.
- Run standalone (Explorer Menu / prefmaint) it executes the redirect to app folder `clinical-office-mpage-setup`.

### 4.5 `1co5_embedded_workflow_comp`
- `parameters = {action: "get-component", componentName: "<Bedrock label>"}` (action match is exact/case-sensitive).
- Runs `1co5_mpage_component` for that label with its standalone reply suppressed, then
  `data = {"data":[{componentName, component, url, cache}]}` (note the doubled `data`: the client reads
  `entry.data.data[0]`). Unknown action → `{"data":[]}`.
- Values: see §5.2.

### 4.6 Select/search services (shared status shape)
`1co5_code_value_search`, `1co5_event_set_search`, `1co5_location_search` all return
`data = {status:{errorInd, message, limitMet, fullDataSetLoaded}, data:[{key, value}]}`; `1co5_prsnl_search`
(mpage-select mode) and the select template return `status:{errorInd, message, count}`. Common parameters:
`search` (unused), `searchLimit`, `physicianInd`, `codeSet`, `valueType`, `searchValue`, `default[]` (selected ids),
`codeSetLimitType`, `codeSetLimits[]`, (`parentCd[]`, `displayField` for event sets/locations).
Algorithm (code_value_search; the others follow it with noted differences):
1. `searchValue` (upper-cased) → prefix match on `upper(<valueType column>)` (`valueType` e.g. `DISPLAY`,
   `DISPLAY_KEY`, `DESCRIPTION`, `DEFINITION`; an empty valueType with a search value breaks the real query).
2. `codeSetLimits` + `codeSetLimitType` ∈ {CDF_MEANING, DISPLAY, DISPLAY_KEY, DESCRIPTION, DEFINITION, CKI,
   CONCEPT_CKI} → column IN list.
3. If `searchLimit > 0`: count candidates (active, not end-dated, in code set). Count > limit → `limitMet = 1`; and if
   no defaults → `errorInd = 1`, `message = "<n> records retrieved. Limit is <limit>."`, no data. Count ≤ limit and no
   search value → `fullDataSetLoaded = 1`.
4. Load (unless errorInd and no defaults): message starts `"No records qualified."`, becomes `"Ok."` when ≥ 1 row.
   Defaults restrict the load **only when the limit was exceeded** (so the select can still show the current
   selection). Rows sorted by the value; `key` = code value, `value` = DISPLAY_KEY / DESCRIPTION / DEFINITION / else
   DISPLAY.
- `1co5_event_set_search`: candidates are the event codes (`key` = event_cd) under event sets (code set 93) via
  `V500_EVENT_SET_EXPLODE`; `parentCd[]` restricts which event sets; search/defaults apply to the event code; display
  column chosen by `displayField` (`display`/`description`/`definition`); load is DISTINCT. Count step is not
  distinct and ignores event-code active status.
- `1co5_location_search`: candidates are code set 220 locations matching the search/limits (on `<valueType>` of the
  location itself), each expanded upward through LOCATION_GROUP (root 0, active) to all ancestors; `parentCd[]` and
  `default[]` are tested against **any member of that ancestor chain including itself**; `key` = matching location,
  `value` = its display/description/definition chosen by `valueType` (displayField is disabled). DISTINCT, sorted by
  value then key.
- `1co5_prsnl_search` (`parameters.mode`, default `mpage-select`):
  - `mpage-select`: `searchValue` "LAST,FIRST" → prefix on PRSNL name_last_key and (if a comma part exists)
    name_first_key; `physicianInd = 1` → physicians only; active + ACTIVE + not end-dated; sorted by full name;
    `data:[{key: personId, value: nameFullFormatted}]`, `status.count` = counted rows (only when searchLimit > 0).
    Difference from code values: with **no search value + searchLimit > 0 + defaults**, the result is **only the
    defaults** even when under the limit.
  - `provider-search`: params `fullName` ("Last, First"), `lastName`, `firstName` (override), `physicianInd`,
    `positionCd[]`; pattern match is exact unless the caller includes `*` wildcards (no implicit trailing `*`); no limit
    check; rows `{personId, nameFullFormatted, positionCd, position, physician: "Yes"|"No"}`, `status:{errorInd,
    message}`.

### 4.7 `1co5_location_tree` (+ `1co5_location_routines`)
Parameters: `branchId` (number), `scriptParams` (a JSON *fragment string* of tree options), `searchText`, `default[]`.
- Options in `scriptParams` (wrapped as `{"param":{...}}`): `showUnits[]` (unit cdf meanings to include, e.g.
  `NURSEUNIT`, `AMBULATORY`; `HIM` also pulls HIM-root location groups), `maxViewLevel` (`ALL` default, `FACILITY`,
  `BUILDING`, `UNIT` — rooms/beds only loaded at `ALL`), `orgSecurity` (default 1 = facility must be in the user's
  PRSNL_ORG_RELTN), `censusInd` (1 = units with census flag only), `rootValue` (unused).
- Hierarchy loaded: facility (LOCATION type FACILITY) → building → unit → room → bed via LOCATION_GROUP (root 0,
  active, not end-dated); one flattened row per bed (or per unit when no rooms).
- Output `data = {"data":[{parentId, id, display, expandable, selected, indeterminate, expanded, dirty, createZone}]}`;
  `display` = code **description**.
  - Drill-down (`branchId > 0`; `1` = virtual root → facilities): children of that node one level down (facility →
    buildings, building → units, unit → rooms, room → beds), sorted by display, `parentId = branchId`,
    `createZone = 1`, `expandable` per child-has-children and `maxViewLevel`.
  - Search (`branchId 0` + `searchText`): rows whose facility/building/unit/room/bed description (lower-case) starts
    with the text; returns the facility rows plus the path down to the deepest match, with `expanded`/`dirty` set.
  - Value (`branchId 1` + `default[]`): the paths to each default location with `selected` on the defaults and
    `indeterminate` on their ancestors.
  - Search/value paths write debug report output in the real script (not part of the JSON).
- The routines script can also be used by custom code with a `fieldName` to compute filtered location lists; not
  reachable from the MPage directly.

### 4.8 Patient/encounter search: `1co5_enc_search` (PRE) + `1co5_enc_search_data` (POST)
The Patient Search component sends both (docs: `cclScript` default `1co5_enc_search_data:group1`), usually with
top-level `clearPatientSource: true` (otherwise the chart/prompt patient is already in patient_source and will be in
the results).
- `enc_search` parameters: `encntrAlias[] = [{alias, cdfMeaning}]` (code set 319), `personAlias[] = [{alias,
  cdfMeaning}]` (code set 4), `fullName` ("Last, First") / `lastName` / `firstName`, `birthDate` (`yyyy-mm-dd`),
  `sexCd`, `personId`.
- Qualification algorithm (replicate literally):
  - A global level counter starts at 0. Encounter-alias search adds N (number of alias criteria) before querying; each
    matching alias row (active + ACTIVE + not end-dated) adds or bumps a candidate `{personId, encntrId}`.
  - Person-alias search adds M, likewise with encntrId 0.
  - Name search runs only if last name has ≥ 2 chars **and** no alias criterion produced a hit; adds 1; last name is an
    exact `patstring` match on name_last_key (caller supplies `*`), optional first-name, birth date (whole day) and sex
    filters; only persons that have a PERSON_PATIENT row, person type PERSON, active + ACTIVE. If the count exceeds
    1000 → `status.code = 1000`, `"More than 1000 patients returned. Please modify your search."`, no candidates.
  - New candidates are created with the current global level; an existing candidate (same person) is bumped by 1 when
    the new row's encntrId is 0 or equal to its own.
  - `personId` mode: lists that person's active encounters, adds 1 to the level, and adds every encounter as a fresh
    candidate at the final level (so all of them qualify and earlier candidates do not).
  - Candidates whose count equals the final level are **appended** to patient_source (patients de-duplicated; visits
    when encntrId > 0).
- `enc_search` output `data = {"status":{"type": "person"|"encounter", "message", "code"}}` — `type` is `encounter`
  when `personId` was supplied; `code` 0 = ok, 99 = `"No records qualified."` (no patients, or personId mode with no
  visits), 1000 = too many.
- `enc_search_data` output `data = {"person":[...], "encounter":[...]}` from current patient_source:
  - `person` (PERSON with ACTIVE status, MRN alias outer; sorted name then id): `personId, name, vip, mrn
    (formatted), sex, birthDate, age, homeAddress, phoneNumbers, ethnicGroup`. `homeAddress` = HOME address
    (code set 212) as "street, street2, street3, street4, city, state, country zip" (blank parts skipped; last address
    wins). `phoneNumbers` = for BUSINESS/HOME/MOBILE (code set 43), ordered by type display descending, first number
    per type: "<Type>: <formatted>" joined with ", " (e.g. `Mobile: (250) 555-0101, Home: (250) 555-0100`).
  - `encounter` (ENCOUNTER with ACTIVE status, FIN NBR alias outer; sorted person, discharge date ascending with
    undischarged first [I], registration date descending): `encntrId, personId, finNumber, facility, nurseUnit,
    roomBed ("room-bed" or room), regDtTm, dischDtTm, medicalService, encounterType, attendingPhysician` (ATTENDDOC
    encounter-prsnl reltn, last wins).

### 4.9 List builders: `1co5_mpage_census_list`, `1co5_mpage_enc_list`, `1co5_get_patient_list`
These **replace** patient_source so the domain scripts in the same payload load the list (docs: `EncounterService.loadList`,
payload preset `ENCOUNTER_LIST_MIN` = encounter aliases + person aliases + typeList MRN).
- `census_list`: current census = ENCNTR_DOMAIN active rows whose encounter is active and **not discharged**.
  typeList 220 filters the encntr_domain nurse unit; typeList 69 filters encounter type class. With no typeList → the
  whole domain census. Output (only when ≥ 1 visit): `data = {"visits":[{personId, encntrId}]}` sorted by person,
  encounter.
- `enc_list`: parameters `dateField` (an ENCOUNTER date column name, e.g. `REG_DT_TM`), `fromDate`, `toDate`,
  optional `organizations: [{orgName}]` matched against ORGANIZATION `org_name_key` (upper-case alnum key; no match →
  empty result). typeList: 19 discharge disposition, 71 encounter type, 34 medical service, 69 encounter type class,
  **220 applies to facility** (the nurse-unit filter is computed but never applied, although the docs call 220 "Nurse
  Unit"). If patient_source already has patients (clearPatientSource false) the search is limited to those persons.
  Active encounters only. Output as census_list.
- `get_patient_list`: prompt `PatientListId`; invoked from custom code or via a `name` carrying the argument. Clears
  patient_source, fetches the list definition and members through Millennium server transactions (600144 then 600123,
  best-encounter mode), and fills patient_source sorted by person/encounter. No JSON output. Simulator: a table
  `patientLists[listId] → [{personId, encntrId}]`.

### 4.10 Documents: `1co5_load_document` (+ `1co5_convert_blob`), `1co5_write_document`
- `load_document`: `parameters.parentEventId`. Reads CLINICAL_EVENT children of that parent (valid, event class DOC)
  joined CE_BLOB_RESULT. Output `data = {status:{message}, document:[{eventId, eventEndDtTm, eventTitleText, eventCd,
  event, eventTag, resultStatusCd, resultStatus, storageCd, storage, formatCd, format, docContent, signature,
  blobHandle, imageUrl}]}`.
  - `message`: `"Invalid Parent Event Id"` (missing param or no rows) or `"Document Loaded."`.
  - For BLOB storage: content is decompressed and converted to **HTML**, then **hex-encoded** into `docContent`
    (client must hex-decode). Non-blob storage → `docContent ""`, `imageUrl "Image"`.
  - `signature`: CE_EVENT_NOTE long blobs for the event, converted to HTML, hex-encoded. Failed conversions → `""`.
- `write_document`: requires **exactly one** visit in patient_source. Parameters `eventKey` (code set 72 display key),
  `title`, `document`, `noteFormat` (code set 23 cdf meaning, e.g. `AS`, `HTML`, `RTF`). Validation order, first
  failure wins: visit count → note format → event key → blank title → blank document. Literal two-character `\n`
  sequences in `document` become real line feeds. Publishes via Cerner's document-publish service as an
  encounter-level clinical document, service time now, PERFORM + SIGN + VERIFY all COMPLETED by the session user.
  Output `data = {status, statusValue, parentEventId}`: errors → `status` = one of `"You must have one valid
  patient_source->visits record"`, `"Invalid Note Format"`, `"Invalid Event Key"`, `"Blank Title Not Allowed"`,
  `"Blank Document Content Not Allowed"`, with `statusValue` = the offending value (or ""), `parentEventId 0`; success →
  `status ""`, `statusValue ""`, `parentEventId` = new parent event id (the publish service's own status is not
  surfaced). Simulator: insert a CLINICAL_EVENT parent + DOC child + blob so `load_document` can read it back.

### 4.11 Templates
- `1co5_mpage_template`: shows the custom-script contract (reference branch adding `refCodeSet` rows with
  `objectName` = script id; output via custom output). Its record `data[{customString, customDate, customCd,
  customPrsnl[{personId, nameFullFormatted, positionCd, position}]}]` is illustrative.
- `1co5_mpage_select_template`: skeleton of the search/select pattern (§4.6) with placeholders; exits early when
  `customScript.clearPatientSource` is not set and there are no patients. Not runnable as shipped.

---

## 5. Standalone / prefmaint scripts

### 5.1 `1co5_mpage_redirect` — prompt `(outdev, path)`
Not called through the entry. Discern Report tab: `REPORT_NAME` runs it with a path.
- If `path` lacks `/index.html`, `/index.html#/` is appended.
- `outdev = "EDGE-COMPONENT"`: look up DM_INFO domain `Clinical Office Component`, name = the original `path` (a
  component label). Found → working path = its `info_char`; `component` = the whole info_char when it is relative,
  or the last `/` segment when it starts with `http`.
- If the working path starts with `http`: `url` = it; for COMPONENT/EDGE-COMPONENT stop here.
- Otherwise read DM_INFO `INS`/`CONTENT_SERVICE_URL`; full URL = `url` if already set, else
  `<content service url>/custom_mpage_content/<path>`. (If that DM_INFO row is missing nothing is produced.)
- Reply:
  - `outdev` COMPONENT / EDGE-COMPONENT → the raw serialised record **with its wrapper**: `{"response":{"url": "...",
    "component": "..."}}` (COMPONENT never sets `component`).
  - Any other outdev → an HTML page whose script sets `window.location.href` to the full URL and whose body says
    "Preparing Report Output".
  - Examples: `path=my-app` → `<csu>/custom_mpage_content/my-app/index.html#/`; `path=https://host/app` (MINE) →
    `https://host/app/index.html#/`; EDGE-COMPONENT with a relative mapping `my-comp` →
    `url=<csu>/custom_mpage_content/my-comp`, `component=my-comp`.

### 5.2 `1co5_mpage_component` — prompt `(headerTitle)`
- DM_INFO `Clinical Office Component` row whose name = `headerTitle`: `successInd = 1`, `componentName` = name;
  relative info_char → `component` = info_char and `url` = `<content service url>/custom_mpage_content/<info_char>`;
  `http…` info_char → `url` = info_char, `component` = last path segment.
- Not found → `successInd 0`, `component ""`, `componentName ""`, `url = "<content service url>/custom_mpage_content/"`.
- `cache = "?" + now as yyyymmddhhmmss` (cache buster the framework appends to `<url>/<component>.js`).
- Standalone reply: `{"response":{"componentName","url","component","cache","successInd"}}` (wrapper kept).
  Under `1co5_embedded_workflow_comp` the standalone reply is suppressed and the values are re-emitted as in §4.5.

### 5.3 `1co5_mpage_test` — prompt `(outdev, filename)`
Back-end replay: reads `1co_debug_<userId>.json` (or the given file) written by debug mode and runs the entry with
person 0, encounter 0, debug 0, id 0, config `{"mode":"CHART"}`. File missing → reply text `"File <name> not found on
<node>"`. Simulator: optional "replay last debug blob" developer action.

### 5.4 `1co5_custom_tables` — prompt `(mode)`
`C`: create sequence `cust_co_ref_seq` and table `CUST_CO_REFERENCE` (ref_id f8 PK; ref_name vc40; ref_task vc40;
description vc100; parent_entity_id f8; parent_entity_name vc32; sequence i4; ref_text zvc32000; active_ind i4;
create_prsnl_id f8; create_dt_tm dq8; updt_id f8; updt_dt_tm dq8; beg/end_effective_dt_tm dq8; indexes (name, task,
parent id, sequence) and (updt time, updt id)). `O`: regenerate the CCL dictionary definition on other nodes. Then
servers 58/79/178/179 must be cycled. Simulator: n/a beyond reporting `customTables`.

---

## 6. Synthetic data model the simulator needs

Tables and the columns actually read (keep `active_ind`, `active_status_cd` (code set 48 ACTIVE), `beg/end_effective_dt_tm`
on everything that is filtered by them):
- Users/session: `PRSNL` (person_id, name_full_formatted, name_last/first, name_last_key/name_first_key, username,
  position_cd, physician_ind, prsnl_type_cd, email, department_cd, section_cd, prim_assign_loc_cd,
  physician_status_cd, logical_domain(_grp)_id, external_ind), PRSNL_ALIAS, CREDENTIAL, PRSNL_GROUP(+_RELTN),
  PRSNL_PRSNL_RELTN, PRSNL_ORG_RELTN.
- People: PERSON (incl. person_type_cd 302 PERSON, name keys, birth/deceased/last-encounter dates, demographic codes),
  PERSON_PATIENT, PERSON_ALIAS (+health card columns), PERSON_NAME, PERSON_PERSON_RELTN, PERSON_PRSNL_RELTN,
  PERSON_ORG_RELTN (+ft_org_name), PERSON_INFO, PERSON_CODE_VALUE_R, PERSON_PLAN_RELTN, HEALTH_PLAN, LONG_TEXT.
- Encounters: ENCOUNTER, ENCNTR_ALIAS, ENCNTR_PERSON_RELTN, ENCNTR_PRSNL_RELTN, ENCNTR_INFO, ENCNTR_PLAN_RELTN,
  ENCNTR_LOC_HIST, ENCNTR_DOMAIN (census).
- Orgs/contacts: ORGANIZATION (org_name, org_name_key, federal_tax_id_nbr, org_status_cd, org_class_cd, external_ind),
  ORGANIZATION_ALIAS, ADDRESS, PHONE (parent_entity_id/name keyed).
- Clinical: ALLERGY, REACTION, ALLERGY_COMMENT, NOMENCLATURE, DIAGNOSIS, PROBLEM, PROBLEM_COMMENT, CLINICAL_EVENT,
  CE_BLOB_RESULT, CE_BLOB, CE_EVENT_NOTE, LONG_BLOB.
- Reference: CODE_VALUE (code_set, cdf_meaning, display, display_key, description, definition, cki, concept_cki,
  active/end date), CODE_VALUE_ALIAS, CODE_VALUE_OUTBOUND, V500_EVENT_SET_EXPLODE, LOCATION, LOCATION_GROUP,
  DM_COLUMNS_DOC (table, column, description, code_set — only for reference mode), BR_DATAMART_* (setup app only).
- Stores the MPage can write: DM_INFO (+LONG_TEXT), CUST_CO_REFERENCE, clinical documents.
- Keep Millennium **zero rows** (encounter 0, nomenclature 0, location 0) — several inner joins rely on them.
- Seed DM_INFO: `INS/CONTENT_SERVICE_URL`, optional `CLINICAL OFFICE/DEVELOPER TEST VISIT` per user,
  `Clinical Office Component/<label>` rows.

## 7. Real-system quirks

Twelve production quirks were found while writing this spec. How the
simulator treats each (correct data, same shapes; behaviour kept and
flagged) is recorded in `QUIRKS.md`.
