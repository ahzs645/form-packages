import { describe, expect, it } from "vitest";

import {
  buildOrderDiagnosesStatusXml,
  buildOrderDiagnosesXml,
  buildOrdersXml,
  buildPowerPlansXml,
  buildScratchpadOrdersXml,
  buildScratchpadXml,
  millenniumOrderRecord,
  parseOrderDiagnosesXml,
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

/* The MPages Development Wiki's value rules and the two documents only it describes. */
describe("wiki-checked order documents", () => {
  it("enforces the wiki's EOrderOriginationFlag (0 inpatient, 1 prescription) and PersonalizedPlanId ≥ 0", () => {
    expect(() => parseScratchpadXml("<Orders><Order><EOrderOriginationFlag>5</EOrderOriginationFlag><SynonymId>3101</SynonymId></Order></Orders>"))
      .toThrow("EOrderOriginationFlag");
    expect(() => parsePowerPlansXml("<Plans><Plan><PathwayCatalogId>7001</PathwayCatalogId><PersonalizedPlanId>-1</PersonalizedPlanId></Plan></Plans>"))
      .toThrow("less than zero");
    /* the wiki's own AddNewOrdersToScratchpad example */
    expect(parseScratchpadXml("<Orders><Order><EOrderOriginationFlag>0</EOrderOriginationFlag><SynonymId>2748023.00</SynonymId><OrderSentenceId>21503426.00</OrderSentenceId></Order></Orders>"))
      .toEqual([{ synonymId: 2748023, origination: "inpatient order", sentenceId: 21503426 }]);
  });

  it("round-trips AddDiagnosesToOrder's input and builds its True/False status reply", () => {
    const wiki = "<Orders><Order><OrderId>18404305.00</OrderId><Diagnoses><DiagnosesId>56087481</DiagnosesId></Diagnoses></Order></Orders>";
    expect(parseOrderDiagnosesXml(wiki)).toEqual([{ orderId: 18404305, diagnosisIds: [56087481] }]);
    expect(parseOrderDiagnosesXml(buildOrderDiagnosesXml([{ orderId: 9, diagnosisIds: [1, 2] }]))).toEqual([{ orderId: 9, diagnosisIds: [1, 2] }]);
    expect(() => parseOrderDiagnosesXml("<Orders><Order><OrderId>9</OrderId></Order></Orders>")).toThrow("DiagnosesId");
    expect(buildOrderDiagnosesStatusXml([{ orderId: 9, diagnoses: [{ id: 1, added: true }, { id: 2, added: false }] }]))
      .toContain('<Order Id="9"><DiagnosisId Value="1">True</DiagnosisId><DiagnosisId Value="2">False</DiagnosisId></Order>');
  });

  it("answers GetScratchPadOrders with the wiki's schema, and \"\" when empty", () => {
    expect(buildScratchpadOrdersXml([])).toBe("");
    expect(buildScratchpadOrdersXml([{ orderId: 0, synonymId: 3101, orderSentenceId: 88 }]))
      .toContain('<Order Id="0"><SynonymId type="double">3101</SynonymId><OrderSentenceId type="double">88</OrderSentenceId></Order>');
  });
});
