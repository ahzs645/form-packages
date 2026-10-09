export { MillenniumDb, END_OF_TIME, isCurrent, toKey, emptyTables } from "./db/db";
export { seedMillenniumDb, stableNumericId, CS, DEFAULT_SIM_USER, type SimPatientInput, type SeedOptions } from "./db/seed";
export type * from "./db/types";
export { parsePromptLine, substituteContextTokens, splitProgramInvocation, programKey, promptNumber, CONTEXT_TOKENS } from "./ccl/params";
export { CCL_ZERO_DATE, cclDate, camelJson, classicRecordJson, cernerAge, formatPhone, rawHex, hexRaw, looksHex } from "./ccl/json";
export type { CclCall, CclReply, CclNotice, CclProgram, CclProgramInfo, CclRunContext, CclTransport, PromptValue, SimSession } from "./ccl/types";
export { createCernerSimulator, missingProgramReply, DEFAULT_SESSION, type CernerSimulator, type SimCallRecord, type SimulatorOptions } from "./simulator";
export { CO5_PROGRAMS, co5Entry } from "./co5/entry";
export { CO5_CUSTOM_SCRIPTS, COMPONENT_DOMAIN, componentLookup } from "./co5/custom";
export { NH_PROGRAMS, nhEntry } from "./nh/entry";
export { CLASSIC_PROGRAMS } from "./classic/programs";
export { createSimXmlCclRequest, XMLCCLREQUEST_STATUS_TEXT, MAX_PARAMETER_LENGTH, type SimXmlCclRequestOptions } from "./transport/xml-ccl-request";
export { handleDiscernWebRequest, matchesDiscernWeb, parseWebBody, type WebRequest, type WebResponse } from "./transport/web-services";
export { installDiscernWebIntercept, type InterceptOptions } from "./transport/intercept";

import { CO5_PROGRAMS } from "./co5/entry";
import { NH_PROGRAMS } from "./nh/entry";
import { CLASSIC_PROGRAMS } from "./classic/programs";
import { createCernerSimulator, type SimulatorOptions } from "./simulator";

/** Every program the package implements. */
export const ALL_SIM_PROGRAMS = [...CO5_PROGRAMS, ...NH_PROGRAMS, ...CLASSIC_PROGRAMS];

/** A simulator with every built-in program registered. */
export function createStandardSimulator(options: Omit<SimulatorOptions, "programs"> & { extraPrograms?: SimulatorOptions["programs"] } = {}) {
  return createCernerSimulator({ ...options, programs: [...ALL_SIM_PROGRAMS, ...(options.extraPrograms ?? [])] });
}
