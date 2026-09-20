// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSmartStyle } from "./use-smart-style";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The hook's job is narrow: hand the root whatever the EHR's style document
 * asks for, and hand it nothing at all the moment anything goes wrong — the
 * page's own `var(--smart-…, <default>)` fallbacks then decide the look.
 * Which values survive parsing is cerner-core's smart-style.test.ts.
 */

const STYLE_URL = "https://ehr.example/smart-style.json";
const SAMPLE = { color_text: "#303030", dim_font_size: "13px", color_background: "#edeae3" };

function Probe({ url }: { url: string | null }) {
  const style = useSmartStyle(url);
  return <div data-testid="root" style={style} />;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const realFetch = globalThis.fetch;

function styleAttribute(): string {
  return container?.querySelector('[data-testid="root"]')?.getAttribute("style") ?? "";
}

async function render(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
}

async function rerender(node: React.ReactNode) {
  await act(async () => {
    root!.render(node);
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  globalThis.fetch = realFetch;
});

describe("useSmartStyle", () => {
  it("sets the EHR's style as custom properties on the element it is given to", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({ ok: true, json: async () => SAMPLE }) as unknown as Response,
    ) as unknown as typeof fetch;

    await render(<Probe url={STYLE_URL} />);

    const style = styleAttribute();
    expect(style).toContain("--smart-color-text: #303030");
    expect(style).toContain("--smart-dim-font-size: 13px");
    expect(style).toContain("--smart-color-background: #edeae3");
  });

  it("never fetches, and sets nothing, when the launch carried no style URL", async () => {
    const fetchImpl = vi.fn();
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    await render(<Probe url={null} />);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(styleAttribute()).toBe("");
  });

  it("leaves the player on its own defaults when the document will not load", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );

    await render(<Probe url={STYLE_URL} />);

    expect(styleAttribute()).toBe("");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("leaves the player on its own defaults when the document is malformed", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({ ok: true, json: async () => ({ color_text: "red } body {" }) }) as unknown as Response,
    ) as unknown as typeof fetch;

    await render(<Probe url={STYLE_URL} />);

    expect(styleAttribute()).toBe("");
  });

  it("drops the EHR's style again if the style URL goes away", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({ ok: true, json: async () => SAMPLE }) as unknown as Response,
    ) as unknown as typeof fetch;

    await render(<Probe url={STYLE_URL} />);
    expect(styleAttribute()).toContain("--smart-color-text");

    await rerender(<Probe url={null} />);
    expect(styleAttribute()).toBe("");
  });

  it("abandons a fetch that is still in flight when the player unmounts", async () => {
    let seen: AbortSignal | undefined;
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return await new Promise<Response>(() => {});
    }) as unknown as typeof fetch;

    await render(<Probe url={STYLE_URL} />);
    expect(seen?.aborted).toBe(false);

    act(() => root!.unmount());
    root = null;
    expect(seen?.aborted).toBe(true);
  });
});
