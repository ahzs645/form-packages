import {
  buildParameterString,
  type MPageMode,
  type MPagePayload,
  type MPageResponse,
} from "./envelope";
import { isInPowerChart, type HostWindowLike } from "./environment";
import { hexDecode, hexEncode, stripControlChars, toAsciiJson } from "./hex";

/**
 * Transport client for an MPage CCL entry script.
 *
 * Inside PowerChart it drives the native window.external.XMLCclRequest
 * bridge (JSON blob via setBlobIn, positional prompt string via send).
 * Anywhere else it POSTs the same envelope, hex-encoded, to Discern Web
 * Services — which is also the dev loop (`/cclproxy` behind a dev proxy).
 *
 * Concurrency is a fixed pool of slots: the slot index is part of the wire
 * protocol (CCL echoes it back for correlation), and the native bridge
 * misbehaves under unbounded parallelism, so calls beyond the pool queue.
 *
 * Runtime code here must stay ES5-safe apart from Promise, which the legacy
 * bundle polyfills.
 */

/** Structural interface over both XMLCclRequest and XMLHttpRequest. */
export interface CclRequestLike {
  open(method: string, url: string, async: boolean, user?: string, password?: string): void;
  send(body?: string): void;
  setRequestHeader?(name: string, value: string): void;
  /** Present on the native XMLCclRequest bridge only. */
  setBlobIn?(blob: string): void;
  onreadystatechange: (() => void) | null;
  readyState: number;
  status: number;
  responseText: string;
}

export interface CclClientOptions {
  /** Entry program including group, e.g. "nh_wf_entry:group1". */
  scriptName: string;
  mode?: MPageMode;
  /** Concurrent request slots; further calls queue. */
  maxInstances?: number;
  /** Discern Web Services base URL for the off-PowerChart path. */
  contextRoot?: string;
  /** Dev-proxy prefix used when running on localhost. */
  proxyPath?: string;
  personId?: number;
  encntrId?: number;
  /** Force whole-number *Cd/*Id/*Float values to f8-typed floats on the wire (default true). */
  forceF8Ids?: boolean;
  timeoutMs?: number;
  credentials?: { username: string; password: string };
  windowRef?: HostWindowLike & { location?: { hostname?: string; origin?: string } };
  /** Override request construction (tests, custom bridges). */
  requestFactory?: (inPowerChart: boolean) => CclRequestLike;
}

export interface ExecuteOptions {
  personId?: number;
  encntrId?: number;
  debugIndicator?: number;
}

/**
 * Status codes the XMLCclRequest bridge reports. 492 (non-fatal error) still
 * carries a usable reply and is treated as success; everything else non-200
 * is a failure.
 */
export const CCL_STATUS_TEXT: Record<number, string> = {
  200: "Success",
  405: "Method Not Allowed",
  409: "Invalid State",
  492: "Non-Fatal Error",
  493: "Memory Error",
  500: "Internal Server Exception",
};

export class CclTransportError extends Error {
  readonly status: number;
  readonly responseText: string;
  constructor(message: string, status: number, responseText: string) {
    super(message);
    this.name = "CclTransportError";
    this.status = status;
    this.responseText = responseText;
  }
}

interface XmlCclRequestConstructorHost {
  external?: { XMLCclRequest?: () => CclRequestLike };
}

function defaultRequestFactory(
  win: CclClientOptions["windowRef"],
  inPowerChart: boolean,
): CclRequestLike {
  if (inPowerChart) {
    const factory = (win as XmlCclRequestConstructorHost | undefined)?.external?.XMLCclRequest;
    if (typeof factory !== "function") {
      throw new Error("XMLCclRequest bridge unavailable despite PowerChart detection");
    }
    return factory();
  }
  if (typeof XMLHttpRequest === "undefined") {
    throw new Error("No transport available: not in PowerChart and XMLHttpRequest is missing");
  }
  return new XMLHttpRequest() as unknown as CclRequestLike;
}

export class CclClient {
  readonly inPowerChart: boolean;
  readonly mode: MPageMode;
  personId: number;
  encntrId: number;

  private readonly options: CclClientOptions;
  private readonly slots: boolean[];
  private readonly waiters: Array<(index: number) => void> = [];

  constructor(options: CclClientOptions) {
    this.options = options;
    this.mode = options.mode ?? "CHART";
    this.personId = options.personId ?? 0;
    this.encntrId = options.encntrId ?? 0;
    const win = options.windowRef ?? (typeof window !== "undefined" ? window : undefined);
    this.inPowerChart = win ? isInPowerChart(win) : false;
    const maxInstances = Math.max(1, options.maxInstances ?? 2);
    this.slots = [];
    for (let i = 0; i < maxInstances; i++) this.slots.push(false);
  }

  execute<T extends MPageResponse = MPageResponse>(
    payload: MPagePayload,
    executeOptions?: ExecuteOptions,
  ): Promise<T> {
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i]) {
        this.slots[i] = true;
        return this.runOnSlot<T>(payload, i, executeOptions);
      }
    }
    return new Promise<T>((resolve, reject) => {
      this.waiters.push((index) => {
        this.runOnSlot<T>(payload, index, executeOptions).then(resolve, reject);
      });
    });
  }

  /** Connectivity/auth probe: an empty-context call that any entry script should answer. */
  ping(): Promise<MPageResponse> {
    return this.execute({ patientSource: [{ personId: 0, encntrId: 0 }] });
  }

  get pendingCount(): number {
    return this.waiters.length;
  }

  private runOnSlot<T extends MPageResponse>(
    payload: MPagePayload,
    index: number,
    executeOptions?: ExecuteOptions,
  ): Promise<T> {
    return this.dispatch<T>(payload, index, executeOptions).then(
      (result) => {
        this.releaseSlot(index);
        return result;
      },
      (error) => {
        this.releaseSlot(index);
        throw error;
      },
    );
  }

  /**
   * Replies echo the resolved chart context; a page that bootstrapped from
   * macro tokens learns its concrete ids from the first round-trip.
   */
  private absorbChartContext(response: MPageResponse): void {
    const chartId = response.chartId;
    if (!chartId) return;
    if (this.personId === 0 && typeof chartId.personId === "number" && chartId.personId > 0) {
      this.personId = chartId.personId;
    }
    if (this.encntrId === 0 && typeof chartId.encntrId === "number" && chartId.encntrId > 0) {
      this.encntrId = chartId.encntrId;
    }
  }

  private releaseSlot(index: number): void {
    const next = this.waiters.shift();
    if (next) {
      next(index);
    } else {
      this.slots[index] = false;
    }
  }

  private buildWebUrl(): string {
    const win = this.options.windowRef ?? (typeof window !== "undefined" ? window : undefined);
    const hostname = win?.location?.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const origin = win?.location?.origin ?? "";
      const proxy = this.options.proxyPath ?? "/cclproxy";
      return origin + proxy + "/" + this.options.scriptName;
    }
    if (!this.options.contextRoot) {
      throw new Error(
        "CclClient: contextRoot is required when running outside PowerChart and off localhost",
      );
    }
    return this.options.contextRoot.replace(/\/$/, "") + "/" + this.options.scriptName;
  }

  private dispatch<T extends MPageResponse>(
    payload: MPagePayload,
    instanceIndex: number,
    executeOptions?: ExecuteOptions,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let request: CclRequestLike;
      try {
        request = this.options.requestFactory
          ? this.options.requestFactory(this.inPowerChart)
          : defaultRequestFactory(this.options.windowRef, this.inPowerChart);
      } catch (error) {
        reject(error);
        return;
      }

      const hexMode = !this.inPowerChart;
      const blob = toAsciiJson({ payload }, { forceF8Ids: this.options.forceF8Ids ?? true });
      const parameterString = buildParameterString({
        mode: this.mode,
        personId: executeOptions?.personId ?? this.personId,
        encntrId: executeOptions?.encntrId ?? this.encntrId,
        debugIndicator: executeOptions?.debugIndicator ?? 0,
        instanceIndex,
        config: { mode: this.mode, hexMode },
        allowContextTokens: this.inPowerChart,
      });

      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        fn();
      };

      if (this.options.timeoutMs && this.options.timeoutMs > 0) {
        timer = setTimeout(() => {
          settle(() =>
            reject(
              new CclTransportError(
                "CCL request timed out after " + this.options.timeoutMs + "ms",
                0,
                "",
              ),
            ),
          );
        }, this.options.timeoutMs);
      }

      request.onreadystatechange = () => {
        if (request.readyState !== 4) return;
        settle(() => {
          if (request.status !== 200 && request.status !== 492) {
            const statusText = CCL_STATUS_TEXT[request.status];
            reject(
              new CclTransportError(
                "CCL request failed with status " +
                  request.status +
                  (statusText ? " (" + statusText + ")" : ""),
                request.status,
                request.responseText,
              ),
            );
            return;
          }
          // A missing CCL program does not 404 — the Discern layer answers
          // with a PDF error document, so this is the reliable sentinel.
          if (request.responseText.substring(0, 4) === "%PDF") {
            reject(
              new CclTransportError(
                "CCL program not found: " + this.options.scriptName,
                404,
                "",
              ),
            );
            return;
          }
          let text = stripControlChars(request.responseText);
          try {
            if (hexMode) text = hexDecode(text);
            const parsed = JSON.parse(text) as T;
            this.absorbChartContext(parsed);
            resolve(parsed);
          } catch {
            reject(
              new CclTransportError(
                "CCL reply was not parseable JSON",
                request.status,
                text.substring(0, 512),
              ),
            );
          }
        });
      };

      try {
        if (this.inPowerChart) {
          if (typeof request.setBlobIn !== "function") {
            throw new Error("XMLCclRequest is missing setBlobIn");
          }
          request.open("GET", this.options.scriptName, true);
          request.setBlobIn(blob);
          request.send(parameterString);
        } else {
          const url = this.buildWebUrl();
          const credentials = this.options.credentials;
          if (credentials) {
            request.open("POST", url, true, credentials.username, credentials.password);
          } else {
            request.open("POST", url, true);
          }
          if (typeof request.setRequestHeader === "function") {
            request.setRequestHeader("Content-Type", "application/json");
          }
          request.send("parameters=" + parameterString + "&blobIn=" + hexEncode(blob));
        }
      } catch (error) {
        settle(() => reject(error));
      }
    });
  }
}
