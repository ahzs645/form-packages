// @vitest-environment happy-dom
/**
 * FormFlow runtime (conditional page flow). The component sources are
 * transpiled and executed the way MOIS runs them (bare React / Fluent /
 * useActiveData / useSourceData / produce / Linear / ButtonBar / DefaultButton
 * globals), with the runtime config produced by the real exporter
 * (buildFormFlowRuntimeConfig), so export and runtime are tested together.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

import {
  evaluateConditionGroup,
  type BuilderPageFlowConfig,
  type FieldConditionGroup,
  type GroupSummary,
  type ParsedField,
} from "@webforms/form-model";
import { buildFormFlowRuntimeConfig, type FormFlowRuntimeConfig } from "@/lib/mois-export/renderers/flow-renderer";
import type { CompiledFieldValidationConfig, MoisExportParams } from "@/lib/mois-export/types";
import { countRepeatItems, normalizePageFlow, repeatItemsChecker, resolveActivePages, resolveNextPage, resolvePagePath, resolvePreviousPage, type PageFlowStep } from "@/lib/page-flow";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

type ActiveData = { field: { data: Record<string, unknown>; status: Record<string, unknown> }; uiState: Record<string, any> };
type SourceData = { webform: { isDraft: string }; lifecycleState: { isPrinting: boolean } };
const ActiveContext = React.createContext<[ActiveData, React.Dispatch<React.SetStateAction<ActiveData>>] | null>(null);
const SourceContext = React.createContext<SourceData>({ webform: { isDraft: "Y" }, lifecycleState: { isPrinting: false } });

const FluentStub = new Proxy({} as Record<string, unknown>, {
  get: (_target, key: string) => {
    if (key === "MessageBarType") return { success: "success" };
    if (key === "DefaultButton") return ({ text, onClick }: { text: string; onClick?: () => void }) => React.createElement("button", { type: "button", onClick }, text);
    if (key === "Link") {
      return ({ children, onClick, disabled, ...rest }: any) =>
        React.createElement("a", { "data-fluent": "Link", onClick: disabled ? undefined : onClick, "aria-label": rest["aria-label"], "aria-current": rest["aria-current"], "aria-disabled": disabled || undefined }, children);
    }
    return ({ children }: { children?: React.ReactNode }) => React.createElement("span", { "data-fluent": key }, children);
  },
});
const Linear = ({ children }: { children?: React.ReactNode }) => <div data-linear="">{children}</div>;
const ButtonBar = ({ children }: { children?: React.ReactNode }) => <div data-buttonbar="">{children}</div>;
const DefaultButton = ({ text, onClick }: { text: string; onClick?: () => void }) => <button type="button" onClick={onClick}>{text}</button>;

type FlowComponent = React.FC<any> & Record<string, any>;
function loadRuntime(): { FormFlow: FlowComponent; FormLogicKit: any } {
  // RepeatForEachTable only for its sync statics (FormFlow syncs follow-up tables off-page).
  const compiled = Babel.transform([read("FormLogicKit"), read("RepeatForEachTable"), read("FormFlow")].join("\n"), { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const scope: Record<string, unknown> = {
    React,
    Fluent: FluentStub,
    produce,
    Linear,
    ButtonBar,
    DefaultButton,
    useActiveData: () => React.useContext(ActiveContext),
    useSourceData: () => React.useContext(SourceContext),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(...Object.keys(scope), `${compiled};\nreturn { FormFlow, FormLogicKit };`);
  return factory(...Object.values(scope));
}
const { FormFlow, FormLogicKit } = loadRuntime();

// ---------- a 4-page form: Patient, Pregnancy (conditional), Medications, Adherence ----------
function field(id: string, kind: ParsedField["kind"] = "text", extra: Partial<ParsedField> = {}): ParsedField {
  return { id, label: extra.label ?? id, kind, rawType: kind, required: false, ...extra } as ParsedField;
}
function group(key: string, fields: ParsedField[]): GroupSummary {
  return { key, prefixLabel: key, prefix: { rawTokens: [], normalizedTokens: [] }, totalFields: fields.length, rows: [], columns: [], entries: fields.map((entry) => ({ field: entry })) } as unknown as GroupSummary;
}
const leaf = (controllerFieldId: string, condition: Record<string, unknown>): FieldConditionGroup =>
  ({ match: "all", conditions: [{ controllerFieldId, condition }] }) as unknown as FieldConditionGroup;

const fields = [
  field("name", "text", { label: "Name" }),
  field("sex", "choice", { label: "Sex", optionDetails: [{ value: "F", label: "Female" }, { value: "M", label: "Male" }] }),
  field("hasMeds", "boolean", { label: "Takes medications" }),
  field("edd", "date", { label: "Due date" }),
  field("meds", "table", { label: "Medications", tableConfig: { columns: [{ id: "drug", label: "Drug", type: "text" }], allowAddRows: true, allowRemoveRows: true } as ParsedField["tableConfig"] }),
  field("taken", "text", { label: "Taken as prescribed" }),
];
const byId = Object.fromEntries(fields.map((entry) => [entry.id, entry]));

function exportParams(pageFlow: BuilderPageFlowConfig): MoisExportParams {
  return {
    builderName: "Flow",
    groups: [group("g1", [byId.name, byId.sex, byId.hasMeds]), group("g2", [byId.edd]), group("g3", [byId.meds]), group("g4", [byId.taken])],
    layoutDrafts: [],
    fields,
    paginationEnabled: true,
    pageCount: 4,
    pageNames: ["Patient", "Pregnancy", "Medications", "Adherence"],
    groupPageAssignments: { g1: 1, g2: 2, g3: 3, g4: 4 },
    pageFlow,
  };
}

const baseFlow: BuilderPageFlowConfig = {
  enabled: true,
  pages: [
    { branches: [{ id: "no-meds", label: "No medications", when: leaf("hasMeds", { type: "boolean-no" }), goTo: "review" }] },
    { activeWhen: leaf("sex", { type: "choice-selected", optionValues: ["F"] }), hiddenAnswerPolicy: "clear" },
  ],
  review: { enabled: true },
  confirmation: { enabled: true, title: "Submitted", body: "We will call you." },
};

const nameRequired: CompiledFieldValidationConfig = {
  fieldId: "name", label: "Name", required: true, requiredCapable: true, hidden: false,
  rules: [], validations: [], optionRules: [], pageIndex: 0,
};

// ---------- harness ----------
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let current: ActiveData;
let setSource: (next: SourceData) => void = () => undefined;
let setActive: React.Dispatch<React.SetStateAction<ActiveData>> = () => undefined;
// The form's translateFormText, when a test sets one.
let hostTranslate: ((source: string) => string) | undefined;

function Host({ initial, config, configs }: { initial: ActiveData; config: FormFlowRuntimeConfig; configs: CompiledFieldValidationConfig[] }) {
  const [state, setState] = React.useState(initial);
  const [source, updateSource] = React.useState<SourceData>({ webform: { isDraft: "Y" }, lifecycleState: { isPrinting: false } });
  current = state;
  setSource = updateSource;
  setActive = setState;
  return (
    <SourceContext.Provider value={source}>
      <ActiveContext.Provider value={[state, setState]}>
        <FormFlow config={config} pageNames={["Patient", "Pregnancy", "Medications", "Adherence"]} validationConfigs={configs} translate={hostTranslate}>
          <FormFlow.Nav />
          {[0, 1, 2, 3].map((pageId) => (
            <FormFlow.Page key={pageId} pageId={pageId}>
              <p data-page-body={pageId}>{`Body ${pageId}`}</p>
              <FormFlow.Steps pageId={pageId} />
            </FormFlow.Page>
          ))}
          <FormFlow.Review />
          <FormFlow.Finish><button type="button">Submit</button></FormFlow.Finish>
          <FormFlow.Confirmation />
        </FormFlow>
      </ActiveContext.Provider>
    </SourceContext.Provider>
  );
}

function mount(
  data: Record<string, unknown>,
  flow = baseFlow,
  configs: CompiledFieldValidationConfig[] = [],
  uiState: Record<string, unknown> = {},
  runtimeConfig?: FormFlowRuntimeConfig,
) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const config = runtimeConfig ?? buildFormFlowRuntimeConfig(exportParams(flow));
  act(() => {
    root!.render(<Host initial={{ field: { data, status: {} }, uiState: { sections: {}, ...uiState } }} config={config} configs={configs} />);
  });
}

afterEach(() => {
  hostTranslate = undefined;
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const visiblePage = () => Array.from(container!.querySelectorAll("[data-page-body]")).map((node) => Number(node.getAttribute("data-page-body")));
const buttons = () => Array.from(container!.querySelectorAll("button")).map((node) => node.textContent);
function click(text: string) {
  const target = Array.from(container!.querySelectorAll("button, a")).find((node) => node.textContent === text || node.getAttribute("aria-label") === text) as HTMLElement | undefined;
  if (!target) throw new Error(`No control "${text}" in ${container!.innerHTML}`);
  act(() => target.click());
}
const navLabels = () => Array.from(container!.querySelectorAll("[data-form-flow-nav] a")).map((node) => node.textContent);

describe("FormFlow navigation", () => {
  it("skips a page whose condition does not hold and lists only active pages", () => {
    mount({ sex: "M", hasMeds: "Y" });
    expect(visiblePage()).toEqual([0]);
    expect(navLabels()).toEqual(["Patient", "Medications", "Adherence", "Review your answers"]);
    expect(buttons()).toEqual(["Next step"]);
    click("Next step");
    expect(visiblePage()).toEqual([2]);
    expect(current.uiState.breadcrumbSelectedKey).toBe(2);
    expect(current.uiState.__flow).toEqual({ history: [0], visited: [0, 2] });
  });

  it("shows the conditional page when its condition holds", () => {
    mount({ sex: { code: "F", display: "Female" }, hasMeds: "Y" });
    click("Next step");
    expect(visiblePage()).toEqual([1]);
  });

  it("follows a branch and goes back through history, not page order", () => {
    mount({ sex: "F", hasMeds: "N" });
    click("Review answers");
    expect(current.uiState.breadcrumbSelectedKey).toBe(4); // review
    expect(visiblePage()).toEqual([]);
    expect(container!.querySelector("[data-form-flow-review]")).not.toBeNull();
    expect(buttons()).toContain("Submit"); // review is the last step
    click("Previous step");
    expect(visiblePage()).toEqual([0]);
    expect(current.uiState.__flow.history).toEqual([]);
  });

  it("blocks Next while the page has issues and clears them once fixed", () => {
    mount({ sex: "M", hasMeds: "Y" }, baseFlow, [nameRequired]);
    click("Next step");
    expect(visiblePage()).toEqual([0]);
    expect(current.uiState.__formErrors).toMatchObject({ source: "page", pageIndex: 0, issues: [{ fieldId: "name", kind: "required" }] });
    expect(container!.querySelector("[data-form-flow-page-errors]")?.textContent).toContain("1 answer");
    act(() => setActive((previous) => produce(previous, (draft) => { draft.field.data.name = "Ada"; })));
    click("Next step");
    expect(visiblePage()).toEqual([2]);
    expect(current.uiState.__formErrors).toBeUndefined();
  });

  it("does not validate when validateOnNext is off for the page", () => {
    mount({ sex: "M", hasMeds: "Y" }, { ...baseFlow, pages: [{ ...baseFlow.pages![0]!, validateOnNext: false }, baseFlow.pages![1]] }, [nameRequired]);
    click("Next step");
    expect(visiblePage()).toEqual([2]);
  });

  it("clears answers on an inactive page with the clear policy", () => {
    mount({ sex: "M", edd: "2026-12-01", taken: "yes" });
    expect(current.field.data.edd).toBeUndefined();
    expect(current.field.data.taken).toBe("yes");
  });

  it("jumps via the breadcrumb and via the preview select-page event", () => {
    mount({ sex: "M", hasMeds: "Y" });
    click("Adherence");
    expect(visiblePage()).toEqual([3]);
    act(() => {
      window.dispatchEvent(new CustomEvent("webforms:preview-select-page", { detail: { pageIndex: 0 } }));
    });
    expect(visiblePage()).toEqual([0]);
  });

  it("renders every active page while printing, never inactive ones", () => {
    mount({ sex: "M", hasMeds: "Y" });
    act(() => setSource({ webform: { isDraft: "Y" }, lifecycleState: { isPrinting: true } }));
    expect(visiblePage()).toEqual([0, 2, 3]);
    expect(container!.querySelector("[data-form-flow-nav]")).toBeNull();
  });
});

describe("FormFlow review + confirmation", () => {
  it("summarises active pages with formatted answers and edit links", () => {
    mount({ name: "Ada", sex: "F", hasMeds: "Y", edd: "2026-12-01", meds: [{ _rowId: "r1", drug: "Metformin" }] }, baseFlow, [], { breadcrumbSelectedKey: 4 });
    const review = container!.querySelector("[data-form-flow-review]")!;
    const text = review.textContent ?? "";
    expect(text).toContain("Female");
    expect(text).toContain("Yes");
    expect(text).toContain("Drug: Metformin");
    expect(text).toContain("Due date");
    expect(text).toContain("Not answered"); // "taken"
    click("Edit Due date");
    expect(visiblePage()).toEqual([1]);
  });

  it("lists only the pages on the path the answers take, re-routing after an edit", () => {
    // sex F makes Pregnancy active, but "no medications" branches page 0 straight to review.
    mount({ name: "Ada", sex: "F", hasMeds: "N", edd: "2026-12-01" }, { ...baseFlow, pages: [baseFlow.pages![0], { ...baseFlow.pages![1]!, hiddenAnswerPolicy: "preserve" }] }, [], { breadcrumbSelectedKey: 4, __flow: { history: [0, 1, 2, 3], visited: [0, 1, 2, 3, 4] } });
    const reviewText = () => container!.querySelector("[data-form-flow-review]")!.textContent ?? "";
    const sections = () => Array.from(container!.querySelectorAll("[data-form-flow-review] section")).map((node) => node.getAttribute("aria-label"));
    expect(sections()).toEqual(["Patient"]);
    expect(reviewText()).not.toContain("Due date");
    expect(reviewText()).not.toContain("Not answered");
    act(() => setActive((previous) => produce(previous, (draft) => { draft.field.data.hasMeds = "Y"; })));
    expect(sections()).toEqual(["Patient", "Pregnancy", "Medications", "Adherence"]);
    expect(reviewText()).toContain("Not answered"); // meds, taken
  });

  it("omits inactive pages from the review", () => {
    mount({ name: "Ada", sex: "M", edd: "2026-12-01" }, { ...baseFlow, pages: [baseFlow.pages![0], { ...baseFlow.pages![1]!, hiddenAnswerPolicy: "preserve" }] }, [], { breadcrumbSelectedKey: 4 });
    expect(container!.querySelector("[data-form-flow-review]")!.textContent).not.toContain("Due date");
  });

  it("shows the confirmation only after this session's submit", () => {
    mount({ sex: "M" });
    act(() => setSource({ webform: { isDraft: "N" }, lifecycleState: { isPrinting: false } }));
    expect(container!.querySelector("[data-form-flow-confirmation]")).toBeNull();

    act(() => root?.unmount());
    mount({ sex: "M" });
    FormFlow.noteSubmitAttempt();
    act(() => setSource({ webform: { isDraft: "N" }, lifecycleState: { isPrinting: false } }));
    const confirmation = container!.querySelector("[data-form-flow-confirmation]");
    expect(confirmation?.textContent).toContain("Submitted");
    expect(confirmation?.textContent).toContain("We will call you.");
    expect(visiblePage()).toEqual([]);
    click("View submitted form");
    expect(visiblePage()).toEqual([0]);
  });

  it("requestReview moves a submit to the review page", () => {
    const config = buildFormFlowRuntimeConfig(exportParams(baseFlow));
    let state: ActiveData = { field: { data: {}, status: {} }, uiState: { breadcrumbSelectedKey: 2, sections: {} } };
    const fd = { ...state, setFormData: (update: (previous: ActiveData) => ActiveData) => { state = update(state); } };
    FormFlow.requestReview(fd, config);
    expect(state.uiState.breadcrumbSelectedKey).toBe(4);
    expect(state.uiState.__flow).toEqual({ history: [2], visited: [0, 4] });
  });
});

describe("review table rows", () => {
  const adherence = field("adh", "table", {
    label: "Adherence",
    tableConfig: {
      columns: [
        { id: "taking", label: "Taking", type: "choice", options: [{ value: "yes", label: "Yes, as prescribed" }, { value: "no", label: "No" }] },
        { id: "prn", label: "As needed", type: "checkbox" },
        { id: "missed", label: "Missed", type: "number" },
      ],
      allowAddRows: false,
      allowRemoveRows: false,
      repeatFor: { sourceFieldId: "meds", labelColumnId: "drug" },
    } as ParsedField["tableConfig"],
  });
  const meds = field("meds", "table", {
    label: "Medications",
    tableConfig: {
      columns: [
        { id: "drug", label: "Drug", type: "text" },
        { id: "status", label: "Status", type: "choice", options: [{ value: "active", label: "Active" }, { value: "stopped", label: "Stopped" }] },
      ],
      allowAddRows: true,
      allowRemoveRows: true,
    } as ParsedField["tableConfig"],
  });
  const params = exportParams(baseFlow);
  const runtime = buildFormFlowRuntimeConfig({
    ...params,
    fields: [...fields.filter((entry) => entry.id !== "meds"), meds, adherence],
    groups: [params.groups[0], params.groups[1], group("g3", [meds]), group("g4", [byId.taken, adherence])],
  });

  it("carries column types, option labels and the repeat row label in the model", () => {
    const model = runtime.model.flatMap((page) => page.fields);
    expect(model.find((entry) => entry.id === "adh")).toMatchObject({
      rowLabel: {},
      columns: [
        { id: "taking", type: "choice", options: { yes: "Yes, as prescribed", no: "No" } },
        { id: "prn", type: "boolean" },
        { id: "missed", label: "Missed" },
      ],
    });
  });

  it("shows repeat rows under their label and choice/boolean cells by label", () => {
    mount({
      name: "Ada", sex: "M", hasMeds: "Y",
      meds: [{ _rowId: "m1", drug: "Metformin", status: "active" }, { _rowId: "m2", drug: "Atorvastatin", status: "stopped" }],
      adh: [
        { _rowId: "a", _sourceKey: "m1", _sourceLabel: "Metformin", _rowStatus: "Complete", taking: "yes", prn: true, missed: 0 },
        { _rowId: "b", _sourceKey: "m2", _sourceLabel: "Atorvastatin", _rowStatus: "Incomplete", taking: "", prn: false },
      ],
    }, baseFlow, [], { breadcrumbSelectedKey: 4 }, runtime);
    const review = container!.querySelector("[data-form-flow-review]")!;
    const text = review.textContent ?? "";
    expect(Array.from(review.querySelectorAll("[data-form-flow-row-heading]")).map((node) => node.textContent)).toEqual(["Metformin", "Atorvastatin"]);
    expect(text).toContain("Taking: Yes, as prescribed; As needed: Yes; Missed: 0");
    expect(text).toContain("AtorvastatinNot answered");
    expect(text).toContain("Drug: Metformin; Status: Active");
    expect(text).toContain("Status: Stopped");
    expect(text).not.toContain("active");
    expect(text).not.toContain("Complete");
  });
});

describe("table \"no rows\" branch", () => {
  // W3's suggested shape for "the medications table has no rows".
  const noRows: BuilderPageFlowConfig = {
    enabled: true,
    pages: [null, null, { branches: [{ id: "no-meds", when: leaf("meds", { type: "empty" }), goTo: "review" }] }],
    review: { enabled: true },
  };
  const runtime = buildFormFlowRuntimeConfig(exportParams(noRows));
  const flow = normalizePageFlow(noRows, 4);
  const cases: Array<[unknown, PageFlowStep]> = [
    [undefined, "review"],
    [[], "review"],
    [[{ _rowId: "r1", drug: "Metformin" }], 3],
    // A row holding only meta keys / blank cells is not an item.
    [[{ _rowId: "r1", _complete: false, drug: "" }], "review"],
    [{ rows: [{ _rowId: "r1", drug: "Metformin" }] }, 3],
  ];

  it.each(cases)("meds=%j goes to %s in runtime and TS", (meds, expected) => {
    const values = { meds };
    expect(FormFlow.resolveNextPage(runtime, 2, values)).toBe(expected);
    // Same table semantics in TS (isConditionValueEmpty) and the runtime
    // (FormLogicKit): "has items" = at least one row with a real answer.
    expect(resolveNextPage(flow, 2, (group) => evaluateConditionGroup(group, () => undefined, values))).toBe(expected);
  });

  it("drives the rendered Next button", () => {
    mount({ sex: "M", meds: [] }, noRows, [], { breadcrumbSelectedKey: 2 });
    click("Review answers");
    expect(current.uiState.breadcrumbSelectedKey).toBe(4);
  });
});

describe("FormFlow parity with lib/page-flow", () => {
  const flows: BuilderPageFlowConfig[] = [
    baseFlow,
    { enabled: true, pages: [{ defaultNext: 2 }, null, { activeWhen: leaf("hasMeds", { type: "boolean-yes" }) }, { branches: [{ id: "b", when: leaf("name", { type: "filled" }), goTo: 1 }] }] },
    { ...baseFlow, review: { enabled: false } },
  ];
  const valueSets: Array<Record<string, unknown>> = [
    {},
    { sex: "F", hasMeds: "Y", name: "x" },
    { sex: { code: "M" }, hasMeds: false },
    { sex: ["F"], hasMeds: "N" },
  ];
  const toStep = (step: unknown) => step;

  it("resolves active pages, Next and Back identically", () => {
    for (const flowConfig of flows) {
      const runtime = buildFormFlowRuntimeConfig(exportParams(flowConfig));
      const flow = normalizePageFlow(flowConfig, 4);
      for (const values of valueSets) {
        const evaluate = (group: FieldConditionGroup) => evaluateConditionGroup(group, () => undefined, values);
        expect(FormFlow.resolveActivePages(runtime, values)).toEqual(resolveActivePages(flow, evaluate));
        expect(FormFlow.resolvePagePath(runtime, values), JSON.stringify(values)).toEqual(resolvePagePath(flow, evaluate));
        const steps: PageFlowStep[] = [0, 1, 2, 3, "review"];
        for (const step of steps) {
          expect(toStep(FormFlow.resolveNextPage(runtime, step, values)), JSON.stringify({ step, values })).toEqual(resolveNextPage(flow, step, evaluate));
          for (const history of [[], [0], [0, 1, 2]]) {
            expect(FormFlow.resolvePreviousPage(runtime, step, history, values)).toEqual(resolvePreviousPage(flow, step, history, evaluate));
          }
        }
      }
    }
    expect(typeof FormLogicKit.evaluateGroup).toBe("function");
  });
});

describe("follow-up tables: skip when no items + off-page sync", () => {
  const meds = field("meds", "table", {
    label: "Medications",
    tableConfig: {
      columns: [
        { id: "drug", label: "Drug", type: "text" },
        { id: "status", label: "Status", type: "choice", options: [{ value: "active", label: "Active" }, { value: "stopped", label: "Stopped" }] },
      ],
      allowAddRows: true,
      allowRemoveRows: true,
    } as ParsedField["tableConfig"],
  });
  const adherence = field("adh", "table", {
    label: "Adherence",
    tableConfig: {
      columns: [{ id: "taking", label: "Taking", type: "choice", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] }],
      allowAddRows: false,
      allowRemoveRows: false,
      repeatFor: {
        sourceFieldId: "meds",
        labelColumnId: "drug",
        filter: { match: "all", conditions: [{ controllerFieldId: "status", condition: { type: "choice-selected", optionValues: ["active"] } }] },
      },
      rowCompletion: { enabled: true, requiredColumnIds: ["taking"], requireAllComplete: true },
    } as ParsedField["tableConfig"],
  });
  const skipFlow: BuilderPageFlowConfig = {
    enabled: true,
    pages: [null, null, null, { skipWhenNoItems: "adh" }],
    review: { enabled: true },
  };
  const params = exportParams(skipFlow);
  const allFields = [...fields.filter((entry) => entry.id !== "meds"), meds, adherence];
  const runtime = buildFormFlowRuntimeConfig({
    ...params,
    fields: allFields,
    groups: [params.groups[0], params.groups[1], group("g3", [meds]), group("g4", [byId.taken, adherence])],
  });
  const adherenceConfig: CompiledFieldValidationConfig = {
    fieldId: "adh", label: "Adherence", required: false, requiredCapable: true, hidden: false,
    rules: [], validations: [], optionRules: [], pageIndex: 3,
    table: { requiredColumnIds: ["taking"], requireAllComplete: true },
  };
  const med = (id: string, drug: string, status = "active") => ({ _rowId: id, drug, status });

  it("exports the follower's source filter on the page and every repeating table's sync spec", () => {
    expect(runtime.pages[3].skipWhenNoItems).toEqual({
      tableId: "adh",
      repeatFor: { sourceFieldId: "meds", filter: { match: "all", conditions: [{ controllerFieldId: "status", condition: { type: "choice-selected", optionValues: ["active"] } }] } },
    });
    expect(runtime.repeatTables?.map((spec) => spec.id)).toEqual(["adh"]);
    expect(runtime.repeatTables?.[0].columns).toEqual([{ id: "taking", type: "dropdown" }]);
    // An id that is not a repeating table is dropped.
    const bogus = buildFormFlowRuntimeConfig({ ...exportParams({ ...skipFlow, pages: [null, { skipWhenNoItems: "meds" }] }), fields: allFields });
    expect(bogus.pages[1].skipWhenNoItems).toBeUndefined();
  });

  it("matches lib/page-flow (active pages, Next, path) for counted source rows", () => {
    const flow = normalizePageFlow(skipFlow, 4);
    const valueSets: Array<Record<string, unknown>> = [
      {},
      { meds: [] },
      { meds: [med("m1", "Metformin", "stopped")] },
      { meds: [med("m1", "Metformin", "stopped"), med("m2", "Insulin")] },
      { meds: [{ _rowId: "blank", drug: "", status: "" }] },
      { meds: [med("m1", "Metformin")], adh: [] }, // an unsynced follower does not matter
    ];
    for (const values of valueSets) {
      const evaluate = (entry: FieldConditionGroup) => evaluateConditionGroup(entry, () => undefined, values);
      const hasItems = repeatItemsChecker(allFields, values);
      expect(FormLogicKit.repeatItemCount(values, runtime.pages[3].skipWhenNoItems!.repeatFor)).toBe(countRepeatItems(values, adherence.tableConfig!.repeatFor));
      expect(FormFlow.resolveActivePages(runtime, values), JSON.stringify(values)).toEqual(resolveActivePages(flow, evaluate, hasItems));
      expect(FormFlow.resolvePagePath(runtime, values)).toEqual(resolvePagePath(flow, evaluate, hasItems));
      for (const step of [0, 1, 2, 3] as PageFlowStep[]) {
        expect(FormFlow.resolveNextPage(runtime, step, values)).toEqual(resolveNextPage(flow, step, evaluate, hasItems));
      }
    }
    expect(FormFlow.resolveNextPage(runtime, 2, { meds: [med("m1", "Metformin", "stopped")] })).toBe("review");
    expect(FormFlow.resolveNextPage(runtime, 2, { meds: [med("m1", "Metformin")] })).toBe(3);
  });

  it("syncs an off-page follower on Next and on the review page, so a new medication blocks until answered", () => {
    // Adherence was answered for Metformin; Insulin was added afterwards (Adherence not shown since).
    mount({
      name: "Ada", sex: "M", hasMeds: "Y",
      meds: [med("m1", "Metformin"), med("m4", "Insulin")],
      adh: [{ _rowId: "a1", _sourceKey: "m1", _sourceLabel: "Metformin", _rowStatus: "Complete", _complete: true, taking: "yes" }],
    }, skipFlow, [adherenceConfig], { breadcrumbSelectedKey: 2 }, runtime);
    click("Next step");
    const rows = () => (current.field.data.adh as Array<Record<string, unknown>>).map((row) => [row._sourceLabel, row.taking, row._rowStatus]);
    expect(rows()).toEqual([["Metformin", "yes", "Complete"], ["Insulin", "", "Incomplete"]]);
    expect(visiblePage()).toEqual([3]);
    // Next from Adherence validates the synced rows.
    click("Review answers");
    expect(current.uiState.__formErrors).toMatchObject({ source: "page", pageIndex: 3, issues: [{ fieldId: "adh", message: "Adherence: complete Insulin" }] });
  });

  it("the review page shows and stores rows for a medication added after Adherence was visited", () => {
    mount({
      name: "Ada", sex: "M", hasMeds: "Y",
      meds: [med("m1", "Metformin"), med("m4", "Insulin")],
      adh: [{ _rowId: "a1", _sourceKey: "m1", _sourceLabel: "Metformin", _rowStatus: "Complete", _complete: true, taking: "yes" }],
    }, skipFlow, [], { breadcrumbSelectedKey: 4 }, runtime);
    const headings = Array.from(container!.querySelectorAll("[data-form-flow-row-heading]")).map((node) => node.textContent);
    expect(headings).toEqual(["Metformin", "Insulin"]);
    expect((current.field.data.adh as unknown[]).length).toBe(2);
  });

  it("skips the follow-up page on Next when no medication is active", () => {
    mount({ name: "Ada", sex: "M", hasMeds: "Y", meds: [med("m1", "Metformin", "stopped")] }, skipFlow, [], { breadcrumbSelectedKey: 2 }, runtime);
    expect(navLabels()).toEqual(["Patient", "Pregnancy", "Medications", "Review your answers"]);
    click("Review answers");
    expect(current.uiState.breadcrumbSelectedKey).toBe(4);
  });
});

describe("FormFlow translation (translateFormText)", () => {
  const french: Record<string, string> = {
    "Next step": "Étape suivante",
    "Previous step": "Étape précédente",
    "Review answers": "Vérifier les réponses",
    "Step {n} of {m}": "Étape {n} sur {m}",
    "Review your answers": "Vérifiez vos réponses",
    Edit: "Modifier",
    "Not answered": "Sans réponse",
    Submitted: "Envoyé",
    "We will call you.": "Nous vous appellerons.",
    "View submitted form": "Voir le formulaire envoyé",
    "1 answer on this page needs attention before you continue.": "1 réponse de cette page est à revoir.",
    "Name is required": "Le nom est obligatoire",
  };
  const translate = (source: string) => french[source] ?? source;

  it("translates buttons, the step label and page-error text, and validates with it", () => {
    hostTranslate = translate;
    mount({ sex: "M", hasMeds: "Y" }, { ...baseFlow, showProgress: true }, [nameRequired]);
    expect(buttons()).toEqual(["Étape suivante"]);
    expect(container!.querySelector("[data-form-flow-nav]")?.textContent).toContain("Étape 1 sur 4");
    expect(navLabels()).toContain("Vérifiez vos réponses");
    click("Étape suivante");
    expect(container!.querySelector("[data-form-flow-page-errors]")?.textContent).toBe("1 réponse de cette page est à revoir.");
    expect(current.uiState.__formErrors.issues[0].message).toBe("Le nom est obligatoire");
  });

  it("translates the review page (built-in and authored text) and the confirmation", () => {
    hostTranslate = translate;
    mount({ name: "Ada", sex: "F", hasMeds: "Y" }, baseFlow, [], { breadcrumbSelectedKey: 4 });
    const review = container!.querySelector("[data-form-flow-review]")!.textContent ?? "";
    expect(review).toContain("Vérifiez vos réponses");
    expect(review).toContain("Sans réponse");
    expect(review).toContain("Modifier");
    expect(review).not.toContain("Not answered");
    act(() => root?.unmount());
    mount({ sex: "M" });
    FormFlow.noteSubmitAttempt();
    act(() => setSource({ webform: { isDraft: "N" }, lifecycleState: { isPrinting: false } }));
    const confirmation = container!.querySelector("[data-form-flow-confirmation]")?.textContent ?? "";
    expect(confirmation).toContain("Envoyé");
    expect(confirmation).toContain("Nous vous appellerons.");
    click("Voir le formulaire envoyé");
    expect(visiblePage()).toEqual([0]);
  });

  it("shows the English text without a translate function", () => {
    mount({ sex: "M", hasMeds: "Y" }, { ...baseFlow, showProgress: true });
    expect(container!.querySelector("[data-form-flow-nav]")?.textContent).toContain("Step 1 of 4");
    expect(buttons()).toEqual(["Next step"]);
  });
});
