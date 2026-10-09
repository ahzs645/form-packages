import type { CernerSimulator } from "../simulator";
import { handleDiscernWebRequest, matchesDiscernWeb } from "./web-services";

/**
 * Answer an MPage's Discern Web Services traffic inside its own window.
 *
 * The simulated endpoints have to work in the static GitHub Pages build,
 * where no server routes exist, so instead of a server the framed page's
 * `fetch` and `XMLHttpRequest` are wrapped: requests for the reports
 * endpoint, the `/cclproxy` dev path or the services directory are answered
 * by the simulator; everything else goes to the network untouched.
 */

type FrameWindow = Window & typeof globalThis;

export interface InterceptOptions {
  /** Origin to advertise in the services-directory link. */
  origin?: string;
  /** Simulated latency, so pages that race their own requests behave as they would over a network. */
  delayMs?: number;
}

export function installDiscernWebIntercept(win: FrameWindow, sim: CernerSimulator, options: InterceptOptions = {}): () => void {
  const origin = options.origin ?? win.location.origin;
  const delay = options.delayMs ?? 5;
  const resolve = (url: string | URL) => new URL(String(url), win.location.href).href;

  const NativeXHR = win.XMLHttpRequest;
  const nativeFetch = win.fetch?.bind(win);

  class SimAwareXMLHttpRequest extends NativeXHR {
    private simTarget: { method: string; url: string } | null = null;
    private simHeaders: Record<string, string> = {};

    open(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null): void {
      const absolute = resolve(url);
      if (matchesDiscernWeb(absolute)) {
        this.simTarget = { method, url: absolute };
        this.define("readyState", 1);
        this.dispatchEvent(new win.Event("readystatechange"));
        return;
      }
      this.simTarget = null;
      if (arguments.length <= 2) super.open(method, absolute);
      else super.open(method, absolute, async ?? true, user ?? null, password ?? null);
    }

    setRequestHeader(name: string, value: string): void {
      if (this.simTarget) { this.simHeaders[name.toLowerCase()] = value; return; }
      super.setRequestHeader(name, value);
    }

    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      const target = this.simTarget;
      if (!target) { super.send(body); return; }
      const text = typeof body === "string" ? body : body instanceof win.URLSearchParams ? body.toString() : body == null ? "" : String(body);
      setTimeout(() => {
        const reply = handleDiscernWebRequest(sim, { method: target.method, url: target.url, body: text }, origin);
        const status = reply?.status ?? 404;
        const responseText = reply?.body ?? "";
        this.define("status", status);
        this.define("statusText", status === 200 ? "OK" : "Not Found");
        this.define("responseURL", target.url);
        this.define("responseText", responseText);
        let response: unknown = responseText;
        if (this.responseType === "json") { try { response = JSON.parse(responseText); } catch { response = null; } }
        this.define("response", response);
        this.define("readyState", 4);
        const contentType = reply?.contentType ?? "text/plain";
        this.getResponseHeader = (name: string) => (name.toLowerCase() === "content-type" ? contentType : null);
        this.getAllResponseHeaders = () => `content-type: ${contentType}\r\n`;
        this.dispatchEvent(new win.Event("readystatechange"));
        /* XHR fires load for any HTTP status; only network failures fire error. */
        this.dispatchEvent(new win.ProgressEvent("load"));
        this.dispatchEvent(new win.ProgressEvent("loadend"));
      }, delay);
    }

    abort(): void {
      if (this.simTarget) { this.simTarget = null; this.dispatchEvent(new win.ProgressEvent("abort")); return; }
      super.abort();
    }

    /** Instance properties shadow the native prototype getters. */
    private define(name: string, value: unknown) {
      Object.defineProperty(this, name, { value, configurable: true, writable: true });
    }
  }

  const simFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolve(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!matchesDiscernWeb(url) || !nativeFetch) return nativeFetch!(input as RequestInfo, init);
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    const body = init?.body == null ? (typeof input === "object" && "text" in input ? await (input as Request).text() : "") : String(init.body);
    await new Promise((done) => setTimeout(done, delay));
    const reply = handleDiscernWebRequest(sim, { method, url, body }, origin);
    return new win.Response(reply?.body ?? "", { status: reply?.status ?? 404, headers: { "content-type": reply?.contentType ?? "text/plain" } });
  };

  Object.defineProperty(win, "XMLHttpRequest", { value: SimAwareXMLHttpRequest, configurable: true, writable: true });
  Object.defineProperty(win, "fetch", { value: simFetch, configurable: true, writable: true });
  return () => {
    Object.defineProperty(win, "XMLHttpRequest", { value: NativeXHR, configurable: true, writable: true });
    if (nativeFetch) Object.defineProperty(win, "fetch", { value: nativeFetch, configurable: true, writable: true });
  };
}
