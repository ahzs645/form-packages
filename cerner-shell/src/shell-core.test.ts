import { describe, expect, it } from "vitest";

import {
  buildAppLinkHref,
  buildPollBlob,
  buildPollParameterString,
  buildTargetUrl,
  decideTier,
  launchPanelStrings,
  parsePollReply,
} from "./shell-core";

describe("decideTier", () => {
  it("routes legacy IE to the launch-out tier", () => {
    expect(decideTier({ document: { documentMode: 11 } })).toBe("legacy");
  });

  it("routes everything else to the modern tier", () => {
    expect(decideTier({ document: {} })).toBe("modern");
    expect(decideTier({})).toBe("modern");
  });
});

describe("buildTargetUrl", () => {
  it("forwards the shell's query string and appends the form id", () => {
    expect(
      buildTargetUrl("https://forms.nh.ca/player/index.html", "?personId=1&encounterId=2", "abc_stamp_form"),
    ).toBe("https://forms.nh.ca/player/index.html?personId=1&encounterId=2&formId=abc_stamp_form");
  });

  it("handles a base URL that already has a query string", () => {
    expect(buildTargetUrl("https://x/p?mode=embed", "personId=1", undefined)).toBe(
      "https://x/p?mode=embed&personId=1",
    );
  });

  it("returns the base unchanged with nothing to append", () => {
    expect(buildTargetUrl("https://x/p", "", undefined)).toBe("https://x/p");
  });

  it("encodes the form id", () => {
    expect(buildTargetUrl("https://x/p", undefined, "a form/1")).toBe(
      "https://x/p?formId=a%20form%2F1",
    );
  });
});

describe("buildAppLinkHref", () => {
  it("wraps the url in an APPLINK mode-100 javascript href", () => {
    expect(buildAppLinkHref("https://forms.nh.ca/p?formId=x")).toBe(
      "javascript:APPLINK(100,'https://forms.nh.ca/p?formId=x','')",
    );
  });

  it("escapes single quotes so the href cannot break out", () => {
    expect(buildAppLinkHref("https://x/p?q='alert(1)'")).toBe(
      "javascript:APPLINK(100,'https://x/p?q=%27alert(1)%27','')",
    );
  });
});

describe("submission polling helpers", () => {
  it("builds a form-store read blob with f8-typed ids", () => {
    const blob = buildPollBlob({ refName: "demo" }, 12, 34);
    expect(JSON.parse(blob)).toEqual({
      payload: {
        patientSource: [{ personId: 12, encntrId: 34 }],
        customScript: {
          script: [
            {
              name: "nh_wf_form_store:group1",
              id: "poll",
              run: "pre",
              parameters: {
                action: "r",
                data: [{ refName: "demo", refTask: "submission", parentEntityId: 34 }],
              },
            },
          ],
        },
      },
    });
    expect(blob).toContain('"personId":12.0');
    expect(blob).toContain('"parentEntityId":34.0');
  });

  it("builds the poll parameter string", () => {
    expect(buildPollParameterString(12, 34)).toBe(
      '^MINE^,12,34,0,0,^{"mode":"CHART","hexMode":false}^',
    );
  });

  it("detects a stored submission row, tolerating control chars", () => {
    const reply =
      '{"runStats":\n{"status":"ok"},"customPre":[{"id":"poll","data":' +
      '{"rows":[{"refName":"demo","refText":"{}"}],"actionStatus":"Read complete"}}]}';
    expect(parsePollReply(reply)).toBe(true);
  });

  it("reports not-submitted for empty rows, other ids, or garbage", () => {
    expect(
      parsePollReply('{"customPre":[{"id":"poll","data":{"rows":[],"actionStatus":"x"}}]}'),
    ).toBe(false);
    expect(parsePollReply('{"customPre":[{"id":"other","data":{"rows":[{"refText":"x"}]}}]}')).toBe(
      false,
    );
    expect(parsePollReply("not json")).toBe(false);
  });
});

describe("launchPanelStrings", () => {
  it("uses the configured title with a default fallback", () => {
    expect(launchPanelStrings({ playerUrl: "x", title: "ABC Stamp" }).title).toBe("ABC Stamp");
    expect(launchPanelStrings({ playerUrl: "x" }).title).toBe("Web Form");
  });
});
