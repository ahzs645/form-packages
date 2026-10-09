import { CS } from "../db/seed";
import { isCurrent } from "../db/db";
import { cernerAge, classicRecordJson, formatPhone } from "../ccl/json";
import { promptNumber } from "../ccl/params";
import type { CclProgramInfo, CclRunContext } from "../ccl/types";

/**
 * Classic single-purpose programs: the shape most site-written MPages use.
 * Prompts are `"MINE", <person id>, <encounter id>`; the reply is
 * `_memory_reply_string = cnvtrectojson(rec)` — one upper-case root key named
 * after the record, upper-case fields, `/Date(…)/` dates.
 *
 * These back the starter templates (public/mpages/templates). Their CCL
 * sources ship beside the templates so a site can compile the same thing.
 */

const json = (body: string) => ({ status: 200, contentType: "application/json", body });

/** wf_demo_demographics: banner, identifiers, home contact and active allergies. */
export function demoDemographics(ctx: CclRunContext) {
  const db = ctx.db;
  const personId = promptNumber(ctx.prompts[1]);
  const encntrId = promptNumber(ctx.prompts[2]);
  const person = db.tables.persons.find((row) => row.personId === personId && isCurrent(row, ctx.now));
  if (!person) {
    ctx.notice({ kind: "warning", message: `wf_demo_demographics: no active person ${personId}. Did the page send the chart's person id (or $PAT_PersonId$)?` });
    return json(classicRecordJson("DEMOGRAPHICS", { PERSON_ID: personId, STATUS: "Z", MESSAGE: "Person not found" }));
  }
  const alias = (meaning: string) => db.tables.personAliases.find((row) => row.personId === personId && isCurrent(row, ctx.now) && row.personAliasTypeCd === db.byMeaning(CS.personAliasType, meaning))?.alias ?? "";
  const home = db.tables.addresses.find((row) => row.parentEntityName === "PERSON" && row.parentEntityId === personId && isCurrent(row, ctx.now));
  const phone = db.tables.phones.find((row) => row.parentEntityName === "PERSON" && row.parentEntityId === personId && isCurrent(row, ctx.now));
  /* Same rule as the CCL beside the template: the encounter must be the person's. */
  const encounter = db.tables.encounters.find((row) => row.encntrId === encntrId && row.personId === personId);
  const fin = encounter ? db.tables.encntrAliases.find((row) => row.encntrId === encounter.encntrId && row.encntrAliasTypeCd === db.byMeaning(CS.encounterAliasType, "FIN NBR"))?.alias ?? "" : "";
  const attending = encounter ? db.tables.encntrPrsnlReltns.find((row) => row.encntrId === encounter.encntrId && row.encntrPrsnlRCd === db.byMeaning(CS.encntrPrsnlReltn, "ATTENDDOC")) : undefined;
  const allergies = db.tables.allergies
    .filter((row) => row.personId === personId && isCurrent(row, ctx.now) && row.reactionStatusCd === db.byMeaning(CS.reactionStatus, "ACTIVE"))
    .map((row) => ({
      SUBSTANCE: db.tables.nomenclature.find((n) => n.nomenclatureId === row.substanceNomId)?.sourceString || row.substanceFtdesc,
      SEVERITY: db.display(row.severityCd),
      REACTIONS: row.reactions.map((r) => db.tables.nomenclature.find((n) => n.nomenclatureId === r.nomenclatureId)?.sourceString || r.reactionFtdesc).join(", "),
    }));
  return json(classicRecordJson("DEMOGRAPHICS", {
    STATUS: "S",
    PERSON_ID: personId,
    NAME_FULL_FORMATTED: person.nameFullFormatted,
    BIRTH_DT_TM: person.birthDtTm,
    AGE: cernerAge(person.birthDtTm, ctx.now),
    SEX: db.display(person.sexCd),
    MRN: alias("MRN"),
    PHN: alias("PHN").replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3"),
    HOME_ADDRESS: home ? [home.streetAddr, home.city, home.state, home.zipcode].filter(Boolean).join(", ") : "",
    HOME_PHONE: phone ? formatPhone(phone.phoneNum) : "",
    ENCOUNTER: encounter ? {
      ENCNTR_ID: encounter.encntrId,
      FIN: fin,
      ENCNTR_TYPE: db.display(encounter.encntrTypeCd),
      LOCATION: [db.display(encounter.locNurseUnitCd), db.display(encounter.locRoomCd), db.display(encounter.locBedCd)].filter(Boolean).join(" / "),
      REG_DT_TM: encounter.regDtTm,
      ATTENDING: attending ? db.prsnlName(attending.prsnlPersonId) : "",
    } : {},
    ALLERGIES: allergies,
  }));
}

/** wf_demo_echo_ids: what the program received — the context check every MPage project starts with. */
export function demoEchoIds(ctx: CclRunContext) {
  const user = ctx.db.tables.prsnl.find((row) => row.personId === ctx.session.prsnlId);
  return json(classicRecordJson("ECHO", {
    PROMPTS: ctx.prompts.map(String),
    PERSON_ID: promptNumber(ctx.prompts[1]),
    ENCNTR_ID: promptNumber(ctx.prompts[2]),
    USER_ID: ctx.session.prsnlId,
    USER_NAME: user?.nameFullFormatted ?? "",
    CUR_NODE: ctx.session.node,
    CUR_DOMAIN: ctx.session.domain,
    TRANSPORT: ctx.call.transport,
  }));
}

export const CLASSIC_PROGRAMS: CclProgramInfo[] = [
  { name: "wf_demo_demographics", description: "Template program: banner, identifiers, contact and allergies (cnvtrectojson form)", program: demoDemographics },
  { name: "wf_demo_echo_ids", description: "Template program: echoes the prompts and session it received", program: demoEchoIds },
];
