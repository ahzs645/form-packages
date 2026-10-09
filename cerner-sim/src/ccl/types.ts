import type { MillenniumDb } from "../db/db";

/** A parsed prompt value: quoted strings stay strings, bare numerics become numbers. */
export type PromptValue = string | number;

export type CclTransport = "powerchart" | "web";

/** The signed-in session and the domain the simulator pretends to be. */
export interface SimSession {
  prsnlId: number;
  /** Millennium domain name; clients read it back as runStats.domain (Clinical Office licences compare it). */
  domain: string;
  node: string;
  /** Services directory host the setup app asks for the MPages web service link. */
  serviceDirectoryUrl: string;
  zone: string;
}

/** Something the inspector should show beside a call: where the simulator differs from production, or a misuse. */
export interface CclNotice {
  kind: "quirk" | "warning" | "info";
  /** Stable id for quirks (see QUIRKS.md), e.g. "co5.clear-patient-source-placement". */
  code?: string;
  message: string;
}

export interface CclCall {
  /** Program name as the page sent it. */
  program: string;
  /** The raw send() parameter string. */
  params: string;
  /** setBlobIn() / the web path's blobIn, still encoded as received. */
  blobIn: string | null;
  transport: CclTransport;
  /** Chart context PowerChart substitutes into $PAT_PersonId$-style tokens. */
  context?: { personId: number; encntrId: number };
}

export interface CclReply {
  status: number;
  body: string;
  contentType?: string;
}

export interface CclRunContext {
  db: MillenniumDb;
  session: SimSession;
  call: CclCall;
  /** Prompt values after token substitution. */
  prompts: PromptValue[];
  now: Date;
  notice(notice: CclNotice): void;
  /** Run another program the way `execute x go` would (used by entry scripts). */
  execute(program: string, prompts: PromptValue[], blobIn?: string | null): CclReply;
}

export type CclProgram = (ctx: CclRunContext) => CclReply;

export interface CclProgramInfo {
  name: string;
  description: string;
  program: CclProgram;
}
