import { describe, expect, it, vi } from "vitest";

import { SMART_STYLE_CUSTOM_PROPERTIES, fetchSmartStyle, parseSmartStyle } from "./smart-style";

/** The document served at https://launch.smarthealthit.org/smart-style.json. */
const SAMPLE = {
  color_background: "#edeae3",
  color_error: "#9e2d2d",
  color_highlight: "#69b5ce",
  color_modal_backdrop: "",
  color_success: "#498e49",
  color_text: "#303030",
  dim_border_radius: "6px",
  dim_font_size: "13px",
  dim_spacing_size: "20px",
  font_family_body: "Georgia, Times, 'Times New Roman', serif",
  font_family_heading: "'HelveticaNeue-Light', Helvetica, Arial, 'Lucida Grande', sans-serif",
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe("parseSmartStyle", () => {
  it("maps the documented SMART style keys to our custom properties", () => {
    expect(parseSmartStyle(SAMPLE)).toEqual({
      "--smart-color-background": "#edeae3",
      "--smart-color-error": "#9e2d2d",
      "--smart-color-highlight": "#69b5ce",
      "--smart-color-success": "#498e49",
      "--smart-color-text": "#303030",
      "--smart-dim-border-radius": "6px",
      "--smart-dim-font-size": "13px",
      "--smart-dim-spacing-size": "20px",
      "--smart-font-family-body": "Georgia, Times, 'Times New Roman', serif",
      "--smart-font-family-heading":
        "'HelveticaNeue-Light', Helvetica, Arial, 'Lucida Grande', sans-serif",
    });
    // The sample's empty modal backdrop is a key with nothing in it, not a
    // declaration to write.
    expect(parseSmartStyle(SAMPLE)["--smart-color-modal-backdrop"]).toBeUndefined();
  });

  it("only ever names properties we own", () => {
    const properties = Object.keys(parseSmartStyle(SAMPLE));
    for (const property of properties) {
      expect(SMART_STYLE_CUSTOM_PROPERTIES).toContain(property);
    }
    expect(SMART_STYLE_CUSTOM_PROPERTIES).toHaveLength(11);
  });

  it("ignores keys the EHR invented and values of the wrong type", () => {
    expect(
      parseSmartStyle({
        color_text: "#303030",
        "--our-own-property": "red",
        color_sidebar: "#fff",
        dim_font_size: 13,
        font_family_body: ["Georgia"],
      }),
    ).toEqual({ "--smart-color-text": "#303030" });
  });

  it("drops values that could break out of the declaration", () => {
    expect(
      parseSmartStyle({
        color_background: "#fff; background-image: url(https://evil.example/pixel.png)",
        color_text: "red } body { display: none",
        color_error: "expression(alert(1))",
        color_highlight: "url(javascript:alert(1))",
        dim_font_size: "13px; position: fixed",
        dim_spacing_size: "20", // a bare number is not a length
        font_family_body: "Georgia</style><script>alert(1)</script>",
        font_family_heading: "Arial; color: red",
      }),
    ).toEqual({});
  });

  it("accepts the colour and length notations CSS actually uses", () => {
    expect(
      parseSmartStyle({
        color_background: "rgba(12, 34, 56, 0.5)",
        color_text: "hsl(210 40% 20%)",
        color_error: "darkred",
        color_success: "#0f0",
        dim_border_radius: "0",
        dim_font_size: "0.875rem",
        dim_spacing_size: "1.5em",
      }),
    ).toEqual({
      "--smart-color-background": "rgba(12, 34, 56, 0.5)",
      "--smart-color-text": "hsl(210 40% 20%)",
      "--smart-color-error": "darkred",
      "--smart-color-success": "#0f0",
      "--smart-dim-border-radius": "0",
      "--smart-dim-font-size": "0.875rem",
      "--smart-dim-spacing-size": "1.5em",
    });
  });

  it("drops a value long enough to be a payload rather than a style", () => {
    expect(parseSmartStyle({ font_family_body: "A".repeat(201) })).toEqual({});
  });

  it("returns nothing for a body that is not a style object", () => {
    for (const body of [null, undefined, "", "{}", 7, [SAMPLE]]) {
      expect(parseSmartStyle(body)).toEqual({});
    }
  });
});

describe("fetchSmartStyle", () => {
  it("fetches and parses the EHR's document without sending credentials", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(SAMPLE));
    const properties = await fetchSmartStyle("https://ehr.example/smart-style.json", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(properties["--smart-color-text"]).toBe("#303030");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://ehr.example/smart-style.json",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("falls back to our own look when there is no URL", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchSmartStyle(null, { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual({});
    expect(await fetchSmartStyle(undefined, { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual({});
    expect(await fetchSmartStyle("", { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual({});
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to our own look when the document will not load", async () => {
    const unreachable = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      fetchSmartStyle("https://ehr.example/smart-style.json", {
        fetchImpl: unreachable as unknown as typeof fetch,
      }),
    ).resolves.toEqual({});
  });

  it("falls back to our own look on a non-2xx reply", async () => {
    const notFound = vi.fn(async () => jsonResponse({ error: "nope" }, false));
    await expect(
      fetchSmartStyle("https://ehr.example/smart-style.json", {
        fetchImpl: notFound as unknown as typeof fetch,
      }),
    ).resolves.toEqual({});
  });

  it("falls back to our own look when the body is not JSON", async () => {
    const html = vi.fn(async () =>
      ({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON at position 0");
        },
      }) as unknown as Response,
    );
    await expect(
      fetchSmartStyle("https://ehr.example/smart-style.json", {
        fetchImpl: html as unknown as typeof fetch,
      }),
    ).resolves.toEqual({});
  });

  it("falls back to our own look when the JSON has nothing usable in it", async () => {
    const junk = vi.fn(async () => jsonResponse({ color_text: "red } body {" }));
    await expect(
      fetchSmartStyle("https://ehr.example/smart-style.json", {
        fetchImpl: junk as unknown as typeof fetch,
      }),
    ).resolves.toEqual({});
  });

  it("says nothing on any of those paths", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    try {
      const failing = vi.fn(async () => {
        throw new Error("offline");
      });
      await fetchSmartStyle("https://ehr.example/smart-style.json", {
        fetchImpl: failing as unknown as typeof fetch,
      });
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
