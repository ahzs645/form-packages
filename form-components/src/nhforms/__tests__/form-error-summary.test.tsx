// @vitest-environment happy-dom
/**
 * FormErrorSummary runtime: the accessible summary the MOIS exporter emits
 * under the form title. Sources are transpiled and run with the bare MOIS
 * globals (React / useActiveData / produce), like the engine does.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

type ActiveData = { field: { data: Record<string, unknown>; status: Record<string, unknown> }; uiState: Record<string, any> };
const ActiveContext = React.createContext<[ActiveData, (updater: (current: ActiveData) => ActiveData) => void] | null>(null);

function loadRuntime(): { FormErrorSummary: React.FC<any>; FormLogicKit: any } {
  const compiled = Babel.transform([read("FormLogicKit"), read("FormErrorSummary")].join("\n"), { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const scope: Record<string, unknown> = {
    React,
    produce,
    useActiveData: () => React.useContext(ActiveContext),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(...Object.keys(scope), `${compiled};\nreturn { FormErrorSummary, FormLogicKit };`);
  return factory(...Object.values(scope));
}
const { FormErrorSummary, FormLogicKit } = loadRuntime();

const configs = [
  { fieldId: "phn", label: "PHN", required: true, requiredCapable: true, hidden: false, rules: [], validations: [], optionRules: [], gates: [], pageIndex: 0, format: "bc-phn" },
  { fieldId: "copay", label: "Copay", required: false, requiredCapable: true, hidden: false, rules: [], validations: [], optionRules: [], gates: [], pageIndex: 1, format: "money" },
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let state: ActiveData;
let setActiveData: ((updater: (current: ActiveData) => ActiveData) => void) | null = null;

function Harness({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState<ActiveData>(state);
  state = active;
  const setFormData = (updater: (current: ActiveData) => ActiveData) => setActive((current) => updater(current));
  setActiveData = setFormData;
  const fd = { ...active, setFormData } as ActiveData & { setFormData: typeof setFormData };
  return <ActiveContext.Provider value={[fd, setFormData]}>{children}</ActiveContext.Provider>;
}

async function mount(data: Record<string, unknown>, uiState: Record<string, unknown>, extra: React.ReactNode = null) {
  state = { field: { data, status: {} }, uiState };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <Harness>
        <FormErrorSummary validationConfigs={configs} pageNames={["Patient", "Billing"]} />
        {extra}
      </Harness>
    );
  });
}

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  host?.remove();
  host = null;
});

const submitErrors = (values: Record<string, unknown>) => ({
  source: "submit",
  issues: FormLogicKit.validate(configs, values),
});

describe("FormErrorSummary", () => {
  it("renders nothing without errors", async () => {
    await mount({}, { breadcrumbSelectedKey: 0 });
    expect(document.querySelector("[data-form-error-summary]")).toBeNull();
  });

  it("is an alert with a heading, focusable at -1, focused when it appears, one link per field", async () => {
    const data = { phn: "9698658216", copay: "-3" };
    await mount(data, { breadcrumbSelectedKey: 0, __formErrors: submitErrors(data) });
    const summary = document.querySelector<HTMLElement>("[data-form-error-summary]")!;
    expect(summary.getAttribute("role")).toBe("alert");
    expect(summary.getAttribute("tabindex")).toBe("-1");
    const heading = summary.querySelector("h2")!;
    expect(heading.textContent).toBe("There is a problem");
    expect(summary.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(document.activeElement).toBe(summary);
    const links = [...summary.querySelectorAll("a")].map((link) => link.textContent);
    expect(links).toEqual([
      "PHN: Enter a valid 10-digit BC Personal Health Number (it starts with 9)",
      "Copay: Enter an amount in dollars and cents, like 12.50 (Billing)",
    ]);
  });

  it("treats a missing breadcrumbSelectedKey as page 0, as MOIS does before any page change", async () => {
    // Real MOIS starts with uiState = { sections: {} } (no breadcrumbSelectedKey).
    const data = { phn: "9698658216", copay: "-3" };
    await mount(data, { sections: {}, __formErrors: submitErrors(data) });
    const links = [...document.querySelectorAll("[data-form-error-summary] a")].map((link) => link.textContent);
    expect(links).toEqual([
      "PHN: Enter a valid 10-digit BC Personal Health Number (it starts with 9)",
      "Copay: Enter an amount in dollars and cents, like 12.50 (Billing)",
    ]);
  });

  it("drops issues the person has fixed since the submit", async () => {
    const data = { phn: "9698658216", copay: "-3" };
    await mount({ ...data, phn: "9698658215" }, { breadcrumbSelectedKey: 0, __formErrors: submitErrors(data) });
    const links = [...document.querySelectorAll("[data-form-error-summary] a")].map((link) => link.textContent);
    expect(links).toEqual(["Copay: Enter an amount in dollars and cents, like 12.50 (Billing)"]);
  });

  it("shows one link for a table's incomplete rows and keeps its row list current", async () => {
    const adherence = {
      fieldId: "adherence", label: "Medication adherence", required: false, requiredCapable: true, hidden: false,
      rules: [], validations: [], optionRules: [], gates: [], pageIndex: 0,
      table: { requiredColumnIds: ["taking"], requireAllComplete: true },
    };
    const rows = (taking: string[]) => ["Metformin", "Atorvastatin", "Levothyroxine"].map((name, index) => ({
      _rowId: `r${index}`, _sourceKey: `m${index}`, _sourceLabel: name, taking: taking[index] ?? "",
    }));
    const data = { adherence: rows([]) };
    const issues = FormLogicKit.validate([adherence], data);
    await mount(data, { breadcrumbSelectedKey: 0, __formErrors: { source: "page", pageIndex: 0, issues } });
    // The harness's summary validates with the module configs; remount with the table config.
    await act(async () => root!.render(
      <Harness>
        <FormErrorSummary validationConfigs={[adherence]} pageNames={["Adherence"]} />
      </Harness>
    ));
    const links = () => [...document.querySelectorAll("[data-form-error-summary] a")].map((link) => link.textContent);
    expect(links()).toEqual(["Medication adherence: complete Metformin, Atorvastatin and Levothyroxine"]);
    await act(async () => setActiveData!((current) => produce(current, (draft) => { draft.field.data.adherence = rows(["yes", "", "no"]); })));
    expect(links()).toEqual(["Medication adherence: complete Atorvastatin"]);
  });

  it("a link jumps to the issue's page (uiState.breadcrumbSelectedKey) and focuses the field", async () => {
    const data = { phn: "9698658215", copay: "12.345" };
    const Page = () => {
      const [fd] = React.useContext(ActiveContext)!;
      return fd.uiState.breadcrumbSelectedKey === 1 ? <input id="copay" /> : null;
    };
    await mount(data, { breadcrumbSelectedKey: 0, __formErrors: submitErrors(data) }, <Page />);
    const link = document.querySelector<HTMLAnchorElement>("[data-form-error-summary] a")!;
    await act(async () => {
      link.click();
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(state.uiState.breadcrumbSelectedKey).toBe(1);
    expect(document.activeElement?.id).toBe("copay");
  });

  it("marks the located MOIS input aria-invalid and describes it by the summary entry, then cleans up", async () => {
    const data = { phn: "12" };
    const Inputs = () => (
      <div data-field-id="phn"><input aria-describedby="phn-help" /></div>
    );
    await mount(data, { breadcrumbSelectedKey: 0, __formErrors: submitErrors(data) }, <Inputs />);
    const input = document.querySelector<HTMLInputElement>("[data-field-id='phn'] input")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby")!.split(" ");
    expect(describedBy[0]).toBe("phn-help");
    const entry = document.getElementById(describedBy[1])!;
    expect(entry.textContent).toContain("PHN");

    // Fixing the answer removes the issue and every attribute the summary added.
    await act(async () => {
      setActiveData!((current) => ({ ...current, field: { ...current.field, data: { phn: "9698658215" } } }));
    });
    expect(document.querySelector("[data-form-error-summary]")).toBeNull();
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.getAttribute("aria-describedby")).toBe("phn-help");
  });

  it("keeps cross-field issues it cannot re-check and shows form-level problems as text", async () => {
    await mount({}, {
      breadcrumbSelectedKey: 0,
      __formErrors: {
        source: "submit",
        issues: [
          { fieldId: "discharge", label: "Discharge", message: "Discharge cannot be before admission.", kind: "cross-field" },
          { fieldId: "_form", label: "", message: "Copy rules did not settle.", kind: "rule" },
        ],
      },
    });
    const summary = document.querySelector("[data-form-error-summary]")!;
    expect(summary.querySelector("a")?.textContent).toBe("Discharge cannot be before admission.");
    expect(summary.textContent).toContain("Copy rules did not settle.");
  });
});

describe("FormErrorSummary translation (translateFormText)", () => {
  it("translates the heading, the other-page name and re-checked messages", async () => {
    const french: Record<string, string> = {
      "There is a problem": "Il y a un problème",
      "Page {n}": "Page {n} (fr)",
      "PHN is required": "Le NSP est obligatoire",
    };
    const translate = (source: string) => french[source] ?? source;
    const data = { copay: "-3" };
    state = { field: { data, status: {} }, uiState: { breadcrumbSelectedKey: 0, __formErrors: submitErrors(data) } };
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <Harness>
          <FormErrorSummary validationConfigs={configs} pageNames={["Patient", ""]} translate={translate} />
        </Harness>
      );
    });
    const summary = document.querySelector<HTMLElement>("[data-form-error-summary]")!;
    expect(summary.querySelector("h2")!.textContent).toBe("Il y a un problème");
    const links = [...summary.querySelectorAll("a")].map((link) => link.textContent);
    expect(links[0]).toBe("Le NSP est obligatoire");
    expect(links[1]).toContain("(Page 2 (fr))");
  });
});
