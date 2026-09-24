import { XMLBuilder, XMLParser } from "fast-xml-parser";

/**
 * The XML PowerChart exchanges with an MPage about orders.
 *
 * Out of PowerChart: `MPAGES_EVENT("ORDERS")` and `GetXMLOrdersMOEW` both
 * answer with `<Orders><OrderVersion/><Order>…</Order>…</Orders>` once orders
 * are signed, and `""` when the user cancelled. The record shape below is the
 * one `geekmdtravis/fluent-cerner-js` (MIT) types for that reply; that library
 * reads only `OrderId`, `OrderedAsMnemonic` and `ClinDisplayLine`, but a host
 * that emits the whole record lets a page that reads more fields find them.
 *
 * Into PowerChart: `AddNewOrdersToScratchpad` and `AddPowerPlanWithDetails`
 * take small XML documents; the parsers here read them the way fluent-cerner-js
 * writes them (whitespace stripped, and — for diagnoses — with the stray commas
 * its array-in-template-literal leaves between `<DiagnosisId>` elements). Both
 * input schemas match the MPages Development Wiki's AddNewOrdersToScratchpad
 * and AddPowerPlanWithDetails pages, and the parsers enforce the wiki's value
 * rules (origination flag 0 or 1, personalized plan id ≥ 0). The reply record
 * above is NOT on the wiki — it is fluent-cerner-js' typing, i.e.
 * reverse-engineered.
 */

export interface MillenniumOrderDetail {
  FieldValueList: { ListValues: { FieldValue: number; FieldDisplayValue: number | string; FieldDtTmValue: string } };
  OeFieldId: number;
  OeFieldMeaning: string;
  OeFieldMeaningId: number;
  ValueRequiredInd: number;
  GroupSeq: number;
  FieldSeq: number;
  ModifiedInd: number;
  DetailAlterFlag: number;
}

export interface MillenniumOrderXml {
  OrderableType: number;
  OrderId: number;
  SynonymId: number;
  ClinCatCd: number;
  CatalogTypeCd: number;
  ActivityTypeCd: number;
  OrderSentenceId: number;
  RxMask: number;
  HnaOrderMnemonic: string;
  OrderedAsMnemonic: string;
  OrderDtTm: string;
  OrigOrderDtTm: string;
  OrderMnemonic: string;
  OrderStatusCd: number;
  OrderStatusDisp: string;
  ClinDisplayLine: string;
  SimpleDisplayLine: string;
  DeptStatusCd: number;
  NeedDoctorCosignInd: number;
  NeedPhysicianValidateInd: number;
  NeedNurseReviewInd: number;
  CommInd: number;
  IngredientInd: number;
  LastUpdtCnt: number;
  MultipleOrdSentInd: number;
  OrderActionId: number;
  TemplateOrderFlag: number;
  TemplateOrderId: number;
  CsFlag: number;
  CsOrderId: number;
  OrderStatus: number;
  SuspendInd: number;
  ResumeInd: number;
  OrderableTypeFlag: number;
  RequiredInd: number;
  ConstantInd: number;
  PrnInd: number;
  FreqTypeFlag: number;
  HybridInd: number;
  NeedRxVerifyFlag: number;
  MedTypeCd: number;
  LastActionSeq: number;
  CommentTypeMask: number;
  StopTypeCd: number;
  ProviderId: number;
  ProviderName: string;
  CommunicationTypeCd: number;
  CurrentStartDtTm: string;
  ProjectedStopDtTm: string;
  TimeZone: number;
  OrigOrdAsFlag: number;
  OrdCommentTemplateId: number;
  DisableOrdCommentInd: number;
  SuspendEffectiveDtTm: string;
  ResumeEffectiveDtTm: string;
  AdditiveCnt: number;
  ClinSigDiluentCnt: number;
  LinkNbr: number;
  LinkTypeFlag: number;
  SuperviseProviderId: number;
  SuperviseProviderName: string;
  BillingProvider: string;
  RelatedOrderObjId: number;
  ActionDtTm: string;
  OeFormatId: number;
  FmtActionCd: number;
  SignedActionCd: number;
  ActionType: number;
  EncntrId: number;
  ProcessMask: number;
  CatalogCd: number;
  ParentId: number;
  ProjectedOrderId: number;
  ProposalAcceptance: string;
  ProposalId: number;
  SignDtTm: string;
  ActionDisplay: string;
  SignedOrderStatusCd: number;
  LastActionPrsnlId: number;
  LastActionPrsnlName: string;
  LastActionDtTm: string;
  /** Keyed by OE field meaning (STRENGTHDOSE, FREQ, RXROUTE, …); OTHER repeats. */
  DetailList: { DetailListCount: number; [meaning: string]: MillenniumOrderDetail | MillenniumOrderDetail[] | number };
  ComplianceDetailList: string;
  CommentList: { CommentValues: { CommentType: number; CommentText: string } } | string;
  AdHocFreqList: { CurrSchedList: string; OrigSchedList: string; PrevSchedList: string };
  DiagnosisList:
    | {
        Diagnosis: {
          DiagnosisId: number;
          NomenclatureId: number;
          SourceVocabularyCd: number;
          SourceIdentifier: string;
          DiagnosisDescription: string;
          DiagnosisRanking: number;
          SearchNomenclatureId: number;
        };
      }
    | string;
  CurrSchedExceptionList: string;
  PrevSchedExceptionList: string;
  OrigSchedExceptionList: string;
  ResponsibleProviderId: number;
  ResponsibleProviderName: string;
  SuspendedDtTm: string;
  RelatedFromOrderId: number;
  OrderRelationTypeCd: number;
  OrderRelationTypeMeaning: string;
  OrderRelationTypeDisplay: string;
  ProposalRejectReasonCd: number;
  ProposalRejectReasonDisplay: string;
  ProposalFreetextRejectReason: string;
}

export interface MillenniumOrdersXml {
  Orders: { OrderVersion: number; Order: MillenniumOrderXml[] };
}

/** What a host knows about an order it has just signed. */
export interface SignedOrderInput {
  orderId: number;
  synonymId: number;
  encntrId: number;
  /** The orderable as the user saw it ("acetaminophen"). */
  mnemonic: string;
  /** The order details line ("650 mg, PO, q6h PRN"). */
  displayLine: string;
  /** "Order", "Discontinue", "Renew", … — the action the signature applied. */
  actionDisplay: string;
  /** "Ordered", "Discontinued", "Suspended", … */
  statusDisplay: string;
  providerId?: number;
  providerName?: string;
  /** ISO-ish local timestamp; defaults to now. */
  dtTm?: string;
  orderSentenceId?: number;
  /** An existing order this action was taken on (renew, reorder, copy). */
  relatedFromOrderId?: number;
}

/* Millennium formats these as `YYYY/MM/DD HH:mm:ss`. */
const millenniumDate = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * A complete order record. Code values are 0 rather than invented: a code
 * value names a row in a domain's CODE_VALUE table, and there is no domain.
 */
export function millenniumOrderRecord(input: SignedOrderInput): MillenniumOrderXml {
  const at = input.dtTm ?? millenniumDate(new Date());
  const provider = input.providerName ?? "";
  const providerId = input.providerId ?? 0;
  return {
    OrderableType: 0,
    OrderId: input.orderId,
    SynonymId: input.synonymId,
    ClinCatCd: 0,
    CatalogTypeCd: 0,
    ActivityTypeCd: 0,
    OrderSentenceId: input.orderSentenceId ?? 0,
    RxMask: 0,
    HnaOrderMnemonic: input.mnemonic,
    OrderedAsMnemonic: input.mnemonic,
    OrderDtTm: at,
    OrigOrderDtTm: at,
    OrderMnemonic: input.mnemonic,
    OrderStatusCd: 0,
    OrderStatusDisp: input.statusDisplay,
    ClinDisplayLine: input.displayLine,
    SimpleDisplayLine: input.displayLine,
    DeptStatusCd: 0,
    NeedDoctorCosignInd: 0,
    NeedPhysicianValidateInd: 0,
    NeedNurseReviewInd: 1,
    CommInd: 0,
    IngredientInd: 0,
    LastUpdtCnt: 0,
    MultipleOrdSentInd: 0,
    OrderActionId: input.orderId,
    TemplateOrderFlag: 0,
    TemplateOrderId: 0,
    CsFlag: 0,
    CsOrderId: 0,
    OrderStatus: 0,
    SuspendInd: input.statusDisplay === "Suspended" ? 1 : 0,
    ResumeInd: 0,
    OrderableTypeFlag: 0,
    RequiredInd: 0,
    ConstantInd: 0,
    PrnInd: /\bPRN\b/i.test(input.displayLine) ? 1 : 0,
    FreqTypeFlag: 0,
    HybridInd: 0,
    NeedRxVerifyFlag: 0,
    MedTypeCd: 0,
    LastActionSeq: 1,
    CommentTypeMask: 0,
    StopTypeCd: 0,
    ProviderId: providerId,
    ProviderName: provider,
    CommunicationTypeCd: 0,
    CurrentStartDtTm: at,
    ProjectedStopDtTm: "",
    TimeZone: 0,
    OrigOrdAsFlag: 0,
    OrdCommentTemplateId: 0,
    DisableOrdCommentInd: 0,
    SuspendEffectiveDtTm: "",
    ResumeEffectiveDtTm: "",
    AdditiveCnt: 0,
    ClinSigDiluentCnt: 0,
    LinkNbr: 0,
    LinkTypeFlag: 0,
    SuperviseProviderId: 0,
    SuperviseProviderName: "",
    BillingProvider: "",
    RelatedOrderObjId: 0,
    ActionDtTm: at,
    OeFormatId: 0,
    FmtActionCd: 0,
    SignedActionCd: 0,
    ActionType: 0,
    EncntrId: input.encntrId,
    ProcessMask: 0,
    CatalogCd: 0,
    ParentId: 0,
    ProjectedOrderId: 0,
    ProposalAcceptance: "",
    ProposalId: 0,
    SignDtTm: at,
    ActionDisplay: input.actionDisplay,
    SignedOrderStatusCd: 0,
    LastActionPrsnlId: providerId,
    LastActionPrsnlName: provider,
    LastActionDtTm: at,
    DetailList: { DetailListCount: 0 },
    ComplianceDetailList: "",
    CommentList: "",
    AdHocFreqList: { CurrSchedList: "", OrigSchedList: "", PrevSchedList: "" },
    DiagnosisList: "",
    CurrSchedExceptionList: "",
    PrevSchedExceptionList: "",
    OrigSchedExceptionList: "",
    ResponsibleProviderId: providerId,
    ResponsibleProviderName: provider,
    SuspendedDtTm: "",
    RelatedFromOrderId: input.relatedFromOrderId ?? 0,
    OrderRelationTypeCd: 0,
    OrderRelationTypeMeaning: "",
    OrderRelationTypeDisplay: "",
    ProposalRejectReasonCd: 0,
    ProposalRejectReasonDisplay: "",
    ProposalFreetextRejectReason: "",
  };
}

const builder = new XMLBuilder({ format: false, suppressEmptyNode: false });

/** The signed-orders reply. An empty list is `""`, which callers read as "cancelled". */
export function buildOrdersXml(orders: readonly SignedOrderInput[]): string {
  if (!orders.length) return "";
  const document: MillenniumOrdersXml = {
    Orders: { OrderVersion: 1, Order: orders.map(millenniumOrderRecord) },
  };
  return builder.build(document);
}

const ARRAYS = new Set(["Orders.Order", "Plans.Plan", "Plans.Plan.Diagnoses.DiagnosisId", "Orders.Order.Diagnoses.DiagnosesId"]);
const parser = new XMLParser({
  parseTagValue: true,
  trimValues: true,
  isArray: (_name, jpath) => ARRAYS.has(String(jpath)),
});

/** Parse a signed-orders reply; `[]` for `""`. Throws on text that is not that document. */
export function parseOrdersXml(xml: string): MillenniumOrderXml[] {
  if (!xml.trim()) return [];
  const parsed = parser.parse(xml) as Partial<MillenniumOrdersXml>;
  if (!parsed.Orders) throw new Error("Not an <Orders> document.");
  return parsed.Orders.Order ?? [];
}

/* --- into PowerChart ---------------------------------------------------- */

export interface ScratchpadOrderInput {
  synonymId: number;
  origination: "inpatient order" | "prescription order";
  sentenceId?: number;
}

/** `AddNewOrdersToScratchpad`'s document, as fluent-cerner-js writes it. */
export function buildScratchpadXml(orders: readonly ScratchpadOrderInput[]): string {
  return `<Orders>${orders.map((order) =>
    `<Order><EOrderOriginationFlag>${order.origination === "inpatient order" ? 0 : 1}</EOrderOriginationFlag>` +
    `<SynonymId>${order.synonymId}</SynonymId><OrderSentenceId>${order.sentenceId ?? ""}</OrderSentenceId></Order>`,
  ).join("")}</Orders>`;
}

export function parseScratchpadXml(xml: string): ScratchpadOrderInput[] {
  const parsed = parser.parse(xml) as {
    Orders?: { Order?: { EOrderOriginationFlag?: number | string; SynonymId?: number | string; OrderSentenceId?: number | string }[] };
  };
  if (!parsed.Orders) throw new Error("Not an <Orders> document.");
  return (parsed.Orders.Order ?? []).map((order) => {
    const synonymId = Number(order.SynonymId);
    if (!(synonymId > 0)) throw new Error(`"${order.SynonymId ?? ""}" is not a synonym id.`);
    const sentence = Number(order.OrderSentenceId);
    /* The wiki's schema: InPatient Order = 0 / Prescription Order = 1, nothing else. */
    const flag = String(order.EOrderOriginationFlag ?? "").trim();
    if (flag !== "0" && flag !== "1") throw new Error(`"${flag}" is not an EOrderOriginationFlag (0 inpatient, 1 prescription).`);
    return {
      synonymId,
      origination: flag === "0" ? "inpatient order" : "prescription order",
      ...(sentence > 0 ? { sentenceId: sentence } : {}),
    };
  });
}

export interface PowerPlanInput {
  pathwayCatalogId: number;
  personalizedPlanId?: number;
  diagnosisIds?: number[];
}

export function buildPowerPlansXml(plans: readonly PowerPlanInput[]): string {
  return `<Plans>${plans.map((plan) =>
    `<Plan><PathwayCatalogId>${plan.pathwayCatalogId}</PathwayCatalogId>` +
    `<PersonalizedPlanId>${plan.personalizedPlanId ?? ""}</PersonalizedPlanId>` +
    `<Diagnoses>${(plan.diagnosisIds ?? []).map((id) => `<DiagnosisId>${id}</DiagnosisId>`).join("")}</Diagnoses></Plan>`,
  ).join("")}</Plans>`;
}

export function parsePowerPlansXml(xml: string): PowerPlanInput[] {
  const parsed = parser.parse(xml) as {
    Plans?: { Plan?: { PathwayCatalogId?: number | string; PersonalizedPlanId?: number | string; Diagnoses?: { DiagnosisId?: (number | string)[] } | string }[] };
  };
  if (!parsed.Plans) throw new Error("Not a <Plans> document.");
  return (parsed.Plans.Plan ?? []).map((plan) => {
    const pathwayCatalogId = Number(plan.PathwayCatalogId);
    if (!(pathwayCatalogId > 0)) throw new Error(`"${plan.PathwayCatalogId ?? ""}" is not a pathway catalog id.`);
    const personalized = Number(plan.PersonalizedPlanId);
    /* The wiki: PersonalizedPlanId "can't be less than zero". */
    if (personalized < 0) throw new Error(`"${plan.PersonalizedPlanId}" is not a personalized plan id; it can't be less than zero.`);
    const diagnoses = typeof plan.Diagnoses === "object" ? plan.Diagnoses.DiagnosisId ?? [] : [];
    return {
      pathwayCatalogId,
      ...(personalized > 0 ? { personalizedPlanId: personalized } : {}),
      diagnosisIds: diagnoses.map(Number).filter((n) => n > 0),
    };
  });
}

/* --- AddDiagnosesToOrder / GetScratchPadOrders (wiki pages of those names) --- */

export interface OrderDiagnosesInput {
  orderId: number;
  diagnosisIds: number[];
}

/**
 * AddDiagnosesToOrder's input. The wiki spells the child element
 * `DiagnosesId` here (and `DiagnosisId` in the status reply and in
 * AddPowerPlanWithDetails) — both spellings are the wiki's.
 */
export function buildOrderDiagnosesXml(orders: readonly OrderDiagnosesInput[]): string {
  return `<Orders>${orders.map((order) =>
    `<Order><OrderId>${order.orderId}</OrderId><Diagnoses>${order.diagnosisIds.map((id) => `<DiagnosesId>${id}</DiagnosesId>`).join("")}</Diagnoses></Order>`,
  ).join("")}</Orders>`;
}

export function parseOrderDiagnosesXml(xml: string): OrderDiagnosesInput[] {
  const parsed = parser.parse(xml) as {
    Orders?: { Order?: { OrderId?: number | string; Diagnoses?: { DiagnosesId?: (number | string)[] } | string }[] };
  };
  if (!parsed.Orders) throw new Error("Not an <Orders> document.");
  const orders = parsed.Orders.Order ?? [];
  if (!orders.length) throw new Error("The document has no <Order>.");
  return orders.map((order) => {
    const orderId = Number(order.OrderId);
    if (!(orderId > 0)) throw new Error(`"${order.OrderId ?? ""}" is not an order id.`);
    const ids = typeof order.Diagnoses === "object" ? order.Diagnoses.DiagnosesId ?? [] : [];
    const diagnosisIds = ids.map(Number);
    if (!diagnosisIds.length || diagnosisIds.some((id) => !(id > 0))) throw new Error(`Order ${orderId} needs one or more <DiagnosesId> values.`);
    return { orderId, diagnosisIds };
  });
}

/** AddDiagnosesToOrder's reply: True for each diagnosis added, False for each that was not. */
export function buildOrderDiagnosesStatusXml(results: readonly { orderId: number; diagnoses: readonly { id: number; added: boolean }[] }[]): string {
  return `<?xml version = "1.0"?><Orders>${results.map((result) =>
    `<Order Id="${result.orderId}">${result.diagnoses.map((d) => `<DiagnosisId Value="${d.id}">${d.added ? "True" : "False"}</DiagnosisId>`).join("")}</Order>`,
  ).join("")}</Orders>`;
}

/** GetScratchPadOrders' reply; `""` when the scratchpad is empty, as the wiki says. */
export function buildScratchpadOrdersXml(orders: readonly { orderId: number; synonymId: number; orderSentenceId?: number }[]): string {
  if (!orders.length) return "";
  return `<?xml version="1.0"?><Orders>${orders.map((order) =>
    `<Order Id="${order.orderId}"><SynonymId type="double">${order.synonymId}</SynonymId><OrderSentenceId type="double">${order.orderSentenceId ?? 0}</OrderSentenceId></Order>`,
  ).join("")}</Orders>`;
}
