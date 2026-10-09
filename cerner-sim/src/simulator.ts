import type { MillenniumDb } from "./db/db";
import { seedMillenniumDb, DEFAULT_SIM_USER, type SimPatientInput } from "./db/seed";
import { hexRaw, looksHex } from "./ccl/json";
import { parsePromptLine, programKey, substituteContextTokens } from "./ccl/params";
import type { CclCall, CclNotice, CclProgramInfo, CclReply, CclRunContext, PromptValue, SimSession } from "./ccl/types";

/** One call as the inspector shows it: decoded request and reply beside the wire values. */
export interface SimCallRecord {
  id: number;
  at: number;
  program: string;
  params: string;
  prompts: PromptValue[];
  transport: CclCall["transport"];
  /** The blob as received, and decoded (hex → text) when it was hex. */
  blobIn: string | null;
  blobText: string | null;
  status: number;
  responseText: string;
  /** The reply decoded when it was hex. */
  responseDecoded: string;
  durationMs: number;
  notices: CclNotice[];
  /** Called by another program (entry → domain scripts), not by the page. */
  nested: boolean;
}

export interface SimulatorOptions {
  db?: MillenniumDb;
  roster?: readonly SimPatientInput[];
  session?: Partial<SimSession>;
  programs?: readonly CclProgramInfo[];
  /** Fixed clock for tests. */
  now?: () => Date;
}

export interface CernerSimulator {
  readonly db: MillenniumDb;
  readonly session: SimSession;
  register(info: CclProgramInfo): void;
  programs(): CclProgramInfo[];
  has(program: string): boolean;
  /** Run a page's call: token substitution, dispatch, logging. */
  execute(call: CclCall): CclReply & { notices: CclNotice[] };
  readonly log: readonly SimCallRecord[];
  subscribe(listener: (record: SimCallRecord) => void): () => void;
  clearLog(): void;
}

export const DEFAULT_SESSION: SimSession = {
  prsnlId: DEFAULT_SIM_USER.personId,
  domain: "WFSIM",
  node: "simnode01",
  serviceDirectoryUrl: "https://services-directory.webforms-sim.local",
  zone: "webforms-sim.local",
};

/**
 * Discern answers a program that does not exist with a PDF error report and
 * status 200, not a 404 — clients detect it by the `%PDF` prefix.
 */
export function missingProgramReply(program: string): CclReply {
  return {
    status: 200,
    contentType: "application/pdf",
    body: `%PDF-1.4\n%Webforms simulator: CCL program ${program} does not exist in this domain.\n`,
  };
}

const MAX_LOG = 200;

export function createCernerSimulator(options: SimulatorOptions = {}): CernerSimulator {
  const db = options.db ?? seedMillenniumDb(options.roster ?? []);
  const session: SimSession = { ...DEFAULT_SESSION, ...options.session };
  const registry = new Map<string, CclProgramInfo>();
  const log: SimCallRecord[] = [];
  const listeners = new Set<(record: SimCallRecord) => void>();
  const clock = options.now ?? (() => new Date());
  let nextId = 1;
  let depth = 0;

  for (const info of options.programs ?? []) registry.set(programKey(info.name), info);

  const decode = (text: string | null) => {
    if (text === null) return null;
    if (!looksHex(text)) return text;
    const decoded = hexRaw(text);
    return /^[\s{[]/.test(decoded) ? decoded : text;
  };

  const run = (call: CclCall, prompts: PromptValue[], notices: CclNotice[]): CclReply => {
    const info = registry.get(programKey(call.program));
    if (!info) {
      notices.push({ kind: "warning", message: `CCL program ${call.program} is not implemented by the simulator; Discern would answer with a PDF error report.` });
      return missingProgramReply(call.program);
    }
    const ctx: CclRunContext = {
      db,
      session,
      call,
      prompts,
      now: clock(),
      notice: (notice) => notices.push(notice),
      execute: (program, nestedPrompts, blobIn = null) =>
        dispatch({ program, params: "", blobIn, transport: call.transport, context: call.context }, nestedPrompts, true),
    };
    try {
      return info.program(ctx);
    } catch (error) {
      notices.push({ kind: "warning", message: `Simulator error in ${call.program}: ${error instanceof Error ? error.message : String(error)}` });
      return { status: 500, body: "" };
    }
  };

  const dispatch = (call: CclCall, prompts: PromptValue[], nested: boolean): CclReply & { notices: CclNotice[] } => {
    const notices: CclNotice[] = [];
    const started = Date.now();
    depth++;
    const reply = run(call, prompts, notices);
    depth--;
    const record: SimCallRecord = {
      id: nextId++,
      at: started,
      program: call.program,
      params: call.params,
      prompts,
      transport: call.transport,
      blobIn: call.blobIn,
      blobText: decode(call.blobIn),
      status: reply.status,
      responseText: reply.body,
      responseDecoded: decode(reply.body) ?? "",
      durationMs: Date.now() - started,
      notices,
      nested: nested || depth > 0,
    };
    log.push(record);
    if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
    for (const listener of listeners) listener(record);
    return { ...reply, notices };
  };

  return {
    db,
    session,
    register(info) {
      registry.set(programKey(info.name), info);
    },
    programs: () => [...registry.values()],
    has: (program) => registry.has(programKey(program)),
    execute(call) {
      let params = call.params ?? "";
      if (call.transport === "powerchart") {
        const user = db.tables.prsnl.find((row) => row.personId === session.prsnlId);
        params = substituteContextTokens(params, {
          personId: call.context?.personId ?? 0,
          encntrId: call.context?.encntrId ?? 0,
          prsnlId: session.prsnlId,
          positionCd: user?.positionCd ?? 0,
        });
      }
      return dispatch({ ...call, params }, parsePromptLine(params), false);
    },
    log,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clearLog() {
      log.length = 0;
    },
  };
}
