import { describe, expect, it } from "vitest";

import {
  buildOrdersXml,
  buildPowerPlansXml,
  buildScratchpadXml,
  millenniumOrderRecord,
  parseOrdersXml,
  parsePowerPlansXml,
  parseScratchpadXml,
} from "./orders-xml";

const signed = {
  orderId: 400001, synonymId: 3101, encntrId: 200001, mnemonic: "acetaminophen",
  displayLine: "650 mg, PO, q6h PRN, pain", actionDisplay: "Order", statusDisplay: "Ordered",
  providerName: "Training, Provider", dtTm: "2026/09/23 10:00:00",
};

describe("signed-orders XML", () => {
  it("emits the full record and reads back the three fields fluent-cerner-js uses", () => {
    const xml = buildOrdersXml([signed, { ...signed, orderId: 400002, mnemonic: "ramipril", displayLine: "5 mg, PO, daily" }]);
    expect(xml.startsWith("<Orders><OrderVersion>1</OrderVersion><Order>")).toBe(true);
    const orders = parseOrdersXml(xml);
    expect(orders.map((o) => [o.OrderId, o.OrderedAsMnemonic, o.ClinDisplayLine])).toEqual([
      [400001, "acetaminophen", "650 mg, PO, q6h PRN, pain"],
      [400002, "ramipril", "5 mg, PO, daily"],
    ]);
    expect(orders[0]).toMatchObject({ PrnInd: 1, EncntrId: 200001, ActionDisplay: "Order", SignDtTm: "2026/09/23 10:00:00" });
    /* every field survives the round trip, not only the three the library reads */
    expect(Object.keys(orders[0])).toEqual(Object.keys(millenniumOrderRecord(signed)));
  });

  it("treats a single order as a list and an empty reply as cancelled", () => {
    expect(parseOrdersXml(buildOrdersXml([signed]))).toHaveLength(1);
    expect(buildOrdersXml([])).toBe("");
    expect(parseOrdersXml("")).toEqual([]);
    expect(() => parseOrdersXml("<Plans/>")).toThrow("Not an <Orders>");
  });

  it("escapes markup in display text", () => {
    const xml = buildOrdersXml([{ ...signed, displayLine: "K < 5.0 & rising" }]);
    expect(parseOrdersXml(xml)[0].ClinDisplayLine).toBe("K < 5.0 & rising");
  });
});

describe("documents sent into the order window", () => {
  it("round-trips the scratchpad document", () => {
    const xml = buildScratchpadXml([
      { synonymId: 3101, origination: "inpatient order" },
      { synonymId: 3102, origination: "prescription order", sentenceId: 88 },
    ]);
    expect(parseScratchpadXml(xml)).toEqual([
      { synonymId: 3101, origination: "inpatient order" },
      { synonymId: 3102, origination: "prescription order", sentenceId: 88 },
    ]);
    expect(() => parseScratchpadXml("<Orders><Order><SynonymId></SynonymId></Order></Orders>")).toThrow("synonym id");
  });

  it("reads PowerPlans, including the commas fluent-cerner-js leaves between diagnoses", () => {
    expect(parsePowerPlansXml(buildPowerPlansXml([{ pathwayCatalogId: 7001, diagnosisIds: [5] }]))).toEqual([
      { pathwayCatalogId: 7001, diagnosisIds: [5] },
    ]);
    const fluent = "<Plans><Plan><PathwayCatalogId>7001</PathwayCatalogId><PersonalizedPlanId></PersonalizedPlanId>" +
      "<Diagnoses><DiagnosisId>5</DiagnosisId>,<DiagnosisId>6</DiagnosisId></Diagnoses></Plan></Plans>";
    expect(parsePowerPlansXml(fluent)).toEqual([{ pathwayCatalogId: 7001, diagnosisIds: [5, 6] }]);
  });
});
