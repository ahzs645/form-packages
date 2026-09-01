import { PAT_PERSON_ID_TOKEN, VIS_ENCNTR_ID_TOKEN } from "./discern";

/**
 * Request/response envelope for an MPage CCL entry script.
 *
 * The wire contract: the JSON payload travels as the request blob, while a
 * positional parameter string `^MINE^,<personId>,<encntrId>,<debugInd>,
 * <instanceIndex>,^<configJson>^` carries chart context and per-call
 * bookkeeping. Chart-level calls that don't yet know their context send the
 * PowerChart macro tokens instead of ids and let the host substitute them.
 */

export type MPageMode = "CHART" | "ORGANIZER";

export interface PatientSource {
  personId: number;
  encntrId: number;
}

export const EMPTY_PATIENT_SOURCE: PatientSource = { personId: 0, encntrId: 0 };

export interface CustomScriptCall {
  /** CCL program name including group, e.g. "nh_wf_forms:group1". */
  name: string;
  /** Echo key: the server splices results back under this id. Required — output without an id is dropped. */
  id: string;
  run: "pre" | "post";
  parameters?: Record<string, unknown>;
}

export interface MPagePayload {
  patientSource?: PatientSource[];
  clearPatientSource?: boolean;
  customScript?: { script: CustomScriptCall[] };
  /** Standard domain sections (person, encounter, allergy, ...) as defined by the entry script. */
  [domain: string]: unknown;
}

export interface RunStats {
  id?: number;
  startTime?: string;
  endTime?: string;
  status?: string;
  hexMode?: number;
  domain?: string;
  node?: string;
  prsnlId?: number;
  prsnlName?: string;
  physicianInd?: number;
  positionCd?: number;
  position?: string;
  username?: string;
  customTables?: string[];
}

export interface ChartId {
  personId?: number;
  encntrId?: number;
  nameFullFormatted?: string;
}

export interface CclError {
  code?: number;
  message?: string;
}

export interface CustomScriptResult<T = unknown> {
  id: string;
  data: T;
}

export interface MPageResponse {
  runStats?: RunStats;
  chartId?: ChartId;
  errors?: CclError[];
  customPre?: CustomScriptResult[];
  customPost?: CustomScriptResult[];
  [key: string]: unknown;
}

export interface ParameterStringInput {
  mode: MPageMode;
  personId?: number;
  encntrId?: number;
  /** 4th positional slot; the entry script treats non-zero as debug. */
  debugIndicator?: number;
  /** Index of the transport slot issuing the call; echoed back for correlation. */
  instanceIndex: number;
  /** Serialized into the trailing ^...^ segment. Must not contain the ^ delimiter. */
  config: { mode: MPageMode; hexMode: boolean };
  /**
   * Whether missing chart context may fall back to the PowerChart macro
   * tokens. Only the in-PowerChart transport can say yes — the host is what
   * substitutes them; over HTTP they would reach CCL as literal strings.
   */
  allowContextTokens: boolean;
}

export function buildParameterString(input: ParameterStringInput): string {
  const configJson = JSON.stringify(input.config);
  if (configJson.indexOf("^") !== -1) {
    throw new Error("buildParameterString: config must not contain the ^ delimiter");
  }
  let person: string;
  let encounter: string;
  if (input.mode === "ORGANIZER") {
    person = "0";
    encounter = "0";
  } else if (input.encntrId && input.encntrId > 0) {
    person = String(input.personId ?? 0);
    encounter = String(input.encntrId);
  } else if (input.allowContextTokens) {
    person = PAT_PERSON_ID_TOKEN;
    encounter = VIS_ENCNTR_ID_TOKEN;
  } else {
    person = String(input.personId ?? 0);
    encounter = "0";
  }
  return (
    "^MINE^," +
    person +
    "," +
    encounter +
    "," +
    String(input.debugIndicator ?? 0) +
    "," +
    String(input.instanceIndex) +
    ",^" +
    configJson +
    "^"
  );
}

/** Pull one custom-script result out of a response by id, checking pre then post. */
export function getCustomResult<T = unknown>(
  response: MPageResponse,
  id: string,
): T | undefined {
  const buckets = [response.customPre, response.customPost];
  for (let b = 0; b < buckets.length; b++) {
    const bucket = buckets[b];
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].id === id) return bucket[i].data as T;
    }
  }
  return undefined;
}
