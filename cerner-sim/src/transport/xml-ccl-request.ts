import type { CernerSimulator } from "../simulator";

/** The six statuses the MPages Development Wiki documents for XMLCclRequest. */
export const XMLCCLREQUEST_STATUS_TEXT: Record<number, string> = {
  200: "Success",
  405: "Method Not Allowed",
  409: "Invalid State",
  492: "Non-Fatal Error",
  493: "Memory Error",
  500: "Internal Server Exception",
};

/** send() parameters must be shorter than this; longer calls abort with 500. */
export const MAX_PARAMETER_LENGTH = 65535;

export interface SimXmlCclRequestOptions {
  /** Chart context PowerChart substitutes into $PAT_PersonId$ / $VIS_EncntrId$, read per call. */
  context: () => { personId: number; encntrId: number };
  warn?: (message: string) => void;
  /** Called after every completed request (the inspector listens on the simulator itself). */
  onComplete?: (program: string, status: number) => void;
}

/**
 * PowerChart's XMLCclRequest, answered by the simulator.
 *
 * Follows the wiki's contract: open(method, name[, async=true]),
 * setBlobIn(blob), send(params < 65535 chars), cleanup(). Async requests
 * complete on a later task and invoke `onreadystatechange()` with no
 * argument — some clients assign the handler after send() and rely on that.
 * Synchronous requests (async=false) complete before send() returns, as the
 * legacy IE pages expect; Edge throws on them, so the call is warned.
 */
export function createSimXmlCclRequest(sim: CernerSimulator, options: SimXmlCclRequestOptions) {
  const warn = options.warn ?? (() => {});
  return class SimXMLCclRequest {
    readyState = 0;
    status = 0;
    statusText = "";
    responseText = "";
    /** The wiki's optional server binding; recorded, not used. */
    requestBinding = "";
    onreadystatechange: (() => void) | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private program = "";
    private async = true;
    private method = "";
    blobIn: string | null = null;
    private generation = 0;
    private cleaned = false;
    private sending = false;

    open(method: string, program: string, async: boolean | number = true) {
      if (this.cleaned) throw new Error("XMLCclRequest was cleaned up; create a new one.");
      this.generation++;
      this.sending = false;
      this.method = String(method ?? "").toUpperCase();
      this.program = String(program ?? "");
      this.async = async !== false && async !== 0;
      if (!this.async) warn("XMLCclRequest: synchronous open() — Microsoft Edge throws on this and Internet Explorer deprecates it. Pass async true or omit it.");
      this.blobIn = null;
      this.status = 0;
      this.statusText = "";
      this.responseText = "";
      this.readyState = 1;
    }

    setBlobIn(blob: string) {
      if (this.readyState !== 1) warn("XMLCclRequest: setBlobIn() called before open().");
      this.blobIn = blob == null ? null : String(blob);
    }

    setRequestHeader() {
      /* accepted and ignored, as the client does */
    }

    getResponseHeader(name: string) {
      return this.readyState === 4 && String(name).toLowerCase() === "content-type" ? "application/json" : null;
    }

    getAllResponseHeaders() {
      return this.readyState === 4 ? "content-type: application/json\r\n" : "";
    }

    send(params = "") {
      if (this.readyState !== 1 || this.sending) {
        this.fail(409, "send() needs a fresh open().");
        return;
      }
      if (this.method !== "GET" && this.method !== "POST") {
        this.fail(405, `method ${this.method || "(none)"} — only GET and POST are documented.`);
        return;
      }
      this.sending = true;
      const generation = this.generation;
      const text = String(params ?? "");
      const complete = () => {
        if (generation !== this.generation || this.cleaned) return;
        if (text.length >= MAX_PARAMETER_LENGTH) {
          warn(`XMLCclRequest: ${this.program} aborted — send() parameters over ${MAX_PARAMETER_LENGTH - 1} characters.`);
          this.finish(500, "", generation);
          return;
        }
        const reply = sim.execute({ program: this.program, params: text, blobIn: this.blobIn, transport: "powerchart", context: options.context() });
        this.finish(reply.status, reply.body, generation);
      };
      if (this.async) {
        this.readyState = 2;
        setTimeout(complete, 0);
      } else {
        complete();
      }
    }

    abort() {
      /* Edge's async XMLCclRequest cannot abort; the client detaches its handler instead. */
      this.generation++;
      this.sending = false;
      this.readyState = 0;
      this.status = 0;
      this.responseText = "";
    }

    cleanup() {
      this.cleaned = true;
      this.sending = false;
      this.generation++;
    }

    private fail(status: number, why: string) {
      warn(`XMLCclRequest: ${XMLCCLREQUEST_STATUS_TEXT[status]} — ${why}`);
      this.finish(status, "", this.generation);
    }

    private finish(status: number, body: string, generation: number) {
      if (generation !== this.generation) return;
      this.sending = false;
      this.status = status;
      this.statusText = XMLCCLREQUEST_STATUS_TEXT[status] ?? "";
      this.responseText = body;
      this.readyState = 4;
      options.onComplete?.(this.program, status);
      this.onreadystatechange?.call(this);
      if (status === 200 || status === 492) this.onload?.call(this);
      else this.onerror?.call(this);
    }
  };
}
