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
- `organization: { aliases }`.
- `allergy: { reactions, comments }`.
- `problem: { comments }`.
- `diagnosis: {}` (no options beyond `skipJSON`).
- `reference: true` — returns the *metadata/definition* view of whichever
  other sections are requested rather than patient data.

## Reply keys

`runStats`, `chartId`, `errors[]`, then per section: `persons`, `encounters`,
`prsnl`, `address`, `phone`, `organization`, `allergies`, `diagnosis`,
`problem`, `codeValues`, `refCodeSet`, plus `customPre[]` / `customPost[]`
holding `{ id, data }` for each custom script.

Note the singular `address` / `phone` / `prsnl` keys against plural
`persons` / `encounters` / `allergies` — consumers key off these exactly.

## Client-side expectations worth honouring

- Whole-number `*Id` / `*Cd` values arrive as `123.0` so `CNVTJSONTOREC`
  types them f8 (`i4` overflows on Millennium ids).
- Replies get control characters `0x00–0x1F` stripped before parsing, so
  never emit raw newlines inside JSON string values.
- The transport keeps a small fixed pool of request slots and queues beyond
  it; long-running scripts block a slot, so keep entry work bounded.
