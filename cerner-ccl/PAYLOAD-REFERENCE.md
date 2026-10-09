# MPage entry-script payload vocabulary

Reference for the request payload an MPage entry script accepts, and the
Cerner tables each option reads. Our `nh_wf_entry.prg` currently implements
the subset marked ✅; the rest is the roadmap if we ever need richer prefill.

Sourced from the documented Clinical Office MPage Developer service contract
and confirmed against observed traffic. Names are the camelCase wire form.

## Envelope

```jsonc
{ "payload": {
    "patientSource": [ { "personId": 0, "encntrId": 0 } ],   // ✅
    "orgSource": [ { "organizationId": 0 } ],                // organization / address / phone
    "clearPatientSource": true,                              // ✅
    "customScript": { "script": [                            // ✅ (whitelisted)
      { "name": "x:group1", "id": "key", "run": "pre|post", "parameters": {} }
    ] },
    "person": { ... }, "encounter": { ... }, "prsnl": { ... },
    "address": true, "phone": true, "organization": { ... },
    "allergy": { ... }, "diagnosis": { ... }, "problem": { ... },
    "codeValue": [ ... ], "typeList": [ ... ], "reference": true
} }
```

Rules that matter:

- An empty `{ "payload": {} }` is valid — it just does nothing.
- Omitting `patientSource` in CHART mode defaults it to the current
  encounter.
- Supplying `encntrId` with `personId: 0` back-fills the person. The reverse
  is deliberately **not** done (a person can have too many encounters).
- `clearPatientSource` wipes the record so a `pre` custom script can populate
  `patient_source` itself — that is how "find qualifying visits, then run the
  standard collectors" works in one round trip.
- Every section accepts `skipJSON: true` — collect the data server-side for a
  later custom script without paying to serialize it back.

## Filtering by type: `typeList`

One `typeList` per payload narrows what the sections collect. Each entry is
`{ "codeSet": 212, "type": "HOME", "typeCd": 0 }`: `type` is a CDF meaning or
display key; leave it `""` and set `typeCd` to filter by the code value
itself. One list can mix code sets, and each section only reads the entries
for its own code sets:

| section | code set | filters |
|---|---|---|
| person `aliases` | 4 | person alias type (MRN, CMRN, …) |
| person `names` | 213 | name type |
| encounter `aliases` | 319 | encounter alias type (FIN NBR, …) |
| encounter `personReltn` | 351 | person relationship type |
| `address` | 212 | address type |
| `phone` | 43 | phone type |
| `allergy` | 12020 / 12025 | substance type / reaction status |
| `problem` | 12030 | life-cycle status |
| `diagnosis` | 17 / 400 | diagnosis type / source vocabulary (400 also applies to problems) |
| `organization` `aliases` | 334 | organization alias type |

Not implemented in `nh_wf_entry.prg` yet; our sections return every active
row.

## Named payload presets

The vendor client ships named presets for common requests. The names are a
ready vocabulary if a prefill setting ever needs to say "how much":
`PERSON_MIN`, `PERSON_PATIENT(_PLUS)`, `ENCOUNTER_MIN`, `ENCOUNTER_ALL(_PLUS)`,
`PRSNL_MIN`, `PRSNL_ALL(_PLUS)`, `APO_ADDR` / `APO_PHONE` / `APO_ALL` /
`APO_ORG` (address, phone, organization), `ALLERGY_ACTIVE` (12025 ACTIVE),
`PROBLEM_ACTIVE` (12030 ACTIVE), `DIAGNOSIS_FINAL` (17 FINAL).

## Section options and their source tables

### person
| option | reads |
|---|---|
| `aliases` | PERSON_ALIAS |
| `names` | PERSON_NAME |
| `patient` | PERSON_PATIENT |
| `personInfo` | PERSON_INFO |
| `personCodeReltn` | PERSON_CODE_RELTN |
| `personPlanReltn` | PERSON_PLAN_RELTN + HEALTH_PLAN |
| `personReltn` | PERSON_RELTN + PERSON |
| `prsnlReltn` | PRSNL_RELTN + PRSNL |
| `orgReltn` | PERSON_ORG_RELTN + ORGANIZATION |
| `loadExtendedPersons` | adds every personId discovered to the patient source and collects those too |

✅ we return the base PERSON row + `aliases`.

### encounter
| option | reads |
|---|---|
| `aliases` | ENCNTR_ALIAS |
| `encounterInfo` | ENCNTR_INFO |
| `encounterPlanReltn` | ENCNTR_PLAN_RELTN + HEALTH_PLAN |
| `locHist` | ENCNTR_LOC_HIST |
| `personReltn` | PERSON_RELTN (+ PERSON name) |
| `prsnlReltn` | ENCNTR_PRSNL_RELTN + PRSNL |
| `loadExtendedPersons` | as above; prsnl records only collected if `prsnl` is also in the payload |

✅ we return the base ENCOUNTER row + `aliases`.

### prsnl
`aliases` (PRSNL_ALIAS), `credential`, `prsnlGroup` (PRSNL_GROUP_RELTN +
PRSNL_GROUP), `prsnlPrsnlReltn` (PRSNL_PRSNL_RELTN + PRSNL), `orgReltn`
(PRSNL_ORG_RELTN + ORGANIZATION), `loadExtendedPersons`.

### smaller sections
- `address: true` / `phone: true` — flat lists keyed by
  `parentEntityId` + `parentEntityName`; only extra option is `skipJSON`.
  They read the people in `patientSource`, or the organizations in
  `orgSource` when that is sent instead.
- `organization: { aliases }`.
- `allergy: { reactions, comments }`.
- `problem: { comments }`.
- `diagnosis: {}` (no options beyond `skipJSON`). Diagnoses belong to an
  **encounter**; allergies and problems belong to the **person**. A form
  scoped to one visit gets that visit's diagnoses but every active allergy
  and problem.
- `reference: true` — returns the *metadata/definition* view of whichever
  other sections are requested rather than patient data.

### codeValue
`codeValue: [{ "cs": 72, "value": 0, "filter": "", "alias": "", "outboundAlias": "" }]`.
A non-zero `value` loads that one code value and ignores `cs`. `alias` /
`outboundAlias` name a contributor source by display key and return each
value's inbound or outbound alias for it. Batch many code sets into one
request rather than one request each: every request holds a pool slot.

**`filter` is raw CCL** spliced into a `where` clause against the
CODE_VALUE table aliased `CV` (for example `CV.CDF_MEANING="NURSE_UNIT"`).
That is an injection surface. If we implement `codeValue`, refuse `filter`
from the client and offer fixed fields (CDF meaning, display key, CKI)
instead.

## Reply keys

`runStats`, `chartId`, `errors[]`, then per section: `persons`, `encounters`,
`prsnl`, `address`, `phone`, `organization`, `allergies`, `diagnosis`,
`problem`, `codeValues`, `refCodeSet`, plus `customPre[]` / `customPost[]`
holding `{ id, data }` for each custom script.

Note the singular `address` / `phone` / `prsnl` keys against plural
`persons` / `encounters` / `allergies` — consumers key off these exactly.

### Row fields we return

`nh_wf_entry.prg` returns a deliberately small row. Alias rows carry enough
to identify an alias without relying on site-configured display text:

| key | person alias | encounter alias | notes |
|---|---|---|---|
| `alias`, `aliasFormatted` | ✅ | ✅ | formatted via the alias pool (`cnvtalias`) |
| `aliasType`, `aliasTypeCd` | ✅ | ✅ | display is site-configured |
| `aliasTypeMeaning` | ✅ | ✅ | code set 4 / 319 meaning: match on this |
| `aliasPool`, `aliasPoolCd` | ✅ | ✅ | |
| `healthCardProvince`, `healthCardVerCode`, `healthCardType`, `healthCardIssueDtTm`, `healthCardExpiryDtTm` | ✅ | — | the BC PHN path; site review pending |

Where the vendor row differs, theirs is the richer shape: person rows use
`sex` / `sexCd` (ours: `gender` / `genderCd`) and add `age`, `nameMiddle`,
`logicalDomainId`; encounter rows add `locNurseUnit` / `locRoom` / `locBed`.
Rename only together with the player, which reads `gender`.

## Client-side expectations worth honouring

- Whole-number `*Id` / `*Cd` values arrive as `123.0` so `CNVTJSONTOREC`
  types them f8 (`i4` overflows on Millennium ids). A list item has no key,
  so lists under such a key (`eventIds`, `typeCds`) are floated element by
  element; `forceF8Arrays` floats whole numbers in every list.
- Non-ASCII text arrives as `\uXXXX` escapes. Whether CNVTJSONTOREC restores
  the original characters is unconfirmed; prior art folds smart quotes to
  ASCII and drops other Unicode before custom-table writes. See the README
  first-compile checklist.
- Every custom script in one payload shares the `PAYLOAD` record: a
  parameter name used by two scripts must have the same JSON type in both.
- Replies get control characters `0x00–0x1F` stripped before parsing, so
  never emit raw newlines inside JSON string values.
- The transport keeps a small fixed pool of request slots and queues beyond
  it; long-running scripts block a slot, so keep entry work bounded.
