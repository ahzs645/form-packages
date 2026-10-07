// @vitest-environment happy-dom
/**
 * SubformScoring data-entry behaviour that builder settings depend on:
 * visibility through FormLogicKit (with the local fallback), time fields,
 * required-field blocking on Done, the read-only/errorMessage contract hosts
 * such as EditableTable and the exporter rely on, and the public wrapper
 * composing a host's onCommitToParent (ChartRecordManager's chart refresh).
 *
 * The component source is compiled on its own with a minimal engine scope,
 * like lib/__tests__/subform-scoring-characterization.test.ts, but backed by
 * React state so edits re-render.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// SubformScoring draws its questions with FieldKit and its dialog with
// DialogKit (Identity components, loaded first with ValueKit).
const SOURCE = ["ValueKit", "FieldKit", "DialogKit", "SubformScoring"]
  .map((name) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8"))
  .join("\n");

type State = { field: { data: Record<string, unknown>; status: Record<string, unknown>; history: unknown[] } };
type Updater = ((current: State) => State | void) | Partial<State>;
/** Injected as the engine-scope FormLogicKit; only evaluateVisibilityRule is used. */
type Kit = { evaluateVisibilityRule: unknown };
type Runtime = {
  SubformScoring: React.ComponentType<Record<string, unknown>>;
  SubformScoringInner: React.ComponentType<Record<string, unknown>>;
};

const h = React.createElement;
const StoreContext = React.createContext<{ state: State; set: (updater: Updater) => void } | null>(null);
let latestState: State | null = null;
let updateParent: (updater: Updater) => void;

function useActiveData(selector?: (state: State) => Record<string, unknown>) {
  const store = React.useContext(StoreContext)!;
  if (!selector) return [{ ...store.state, setFormData: store.set }, store.set];
  return [selector(store.state), (updates: Record<string, unknown>) => store.set(current => {
    Object.assign(selector(current), updates);
  })];
}

function Store({ initial, children }: React.PropsWithChildren<{ initial: Record<string, unknown> }>) {
  const [state, setState] = React.useState<State>({ field: { data: initial, status: {}, history: [] } });
  latestState = state;
  const set = React.useCallback((updater: Updater) => {
    setState((current) => {
      if (typeof updater === "function") {
        const draft = JSON.parse(JSON.stringify(current)) as State;
        return (updater(draft) as State | undefined) ?? draft;
      }
      return { ...current, ...updater };
    });
  }, []);
  updateParent = set;
  return h(StoreContext.Provider, { value: { state, set } }, children);
}

function loadRuntime(kit?: Kit, realScoring = false, cloneSession?: (value: unknown) => unknown): Runtime {
  const scoringSource = realScoring
    ? `const ScoringModule = (() => { ${fs.readFileSync(path.join(NH, "ScoringModule/index.jsx"), "utf8")}
return ScoringModule; })();`
    : "";
  const compiled = Babel.transform(SOURCE + "\n" + scoringSource, { presets: ["react"], filename: "SubformScoring/index.jsx" }).code ?? "";
  const Box = ({ children }: React.PropsWithChildren) => h("div", null, children);
  const Text = ({ children }: React.PropsWithChildren) => h("span", null, children);
  const Label = ({ children, required }: React.PropsWithChildren<{ required?: boolean }>) =>
    h("label", null, children, required ? " *" : null);
  const Button = ({ text, onClick, disabled }: { text?: string; onClick?: () => void; disabled?: boolean }) =>
    h("button", { type: "button", onClick, disabled }, text);
  const Dialog = ({ hidden, children }: React.PropsWithChildren<{ hidden?: boolean }>) =>
    hidden ? null : h("div", { role: "dialog" }, children);
  const control = (kind: string, emit: (props: Record<string, unknown>, value: string, event: unknown) => void) =>
    (props: Record<string, unknown>) =>
      h("input", {
        "data-control": kind,
        "data-readonly": props.readOnly ? "true" : "false",
        placeholder: props.placeholder as string | undefined,
        value: (props.value as string | undefined) ?? "",
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => emit(props, event.target.value, event),
      });
  const scope: Record<string, unknown> = {
    React,
    Fluent: {
      Stack: Box, StackItem: Box, TooltipHost: Box, Separator: Box, Label, Text, PrimaryButton: Button, DefaultButton: Button, Dialog,
      DialogType: { largeHeader: "largeHeader" }, Toggle: () => null,
    },
    useActiveData,
    useSourceData: () => ({}),
    useMutation: () => [async () => undefined],
    useTheme: () => ({}),
    produce,
    ScoringModule: () => null,
    // The MOIS SubForm DialogKit draws on, and its button bar.
    SubForm: ({ hidden, label, children }: React.PropsWithChildren<{ hidden?: boolean; label?: React.ReactNode }>) =>
      hidden ? null : h("div", { role: "dialog" }, label ? h("h2", null, label) : null, children),
    ButtonBar: Box,
    // DateTimeSelect is store-bound in the engine: it reads and writes
    // section.activeSelector(fd)[fieldId] (FieldKit's value box).
    DateTimeSelect: (props: Record<string, any>) => {
      const [fd, set] = useActiveData() as [Record<string, unknown>, (updater: unknown) => void];
      const value = props.section.activeSelector(fd)[props.fieldId];
      return h("input", {
        "data-control": "datetime",
        value: value ?? "",
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const next = event.target.value;
          set((draft: unknown) => { props.section.activeSelector(draft)[props.fieldId] = next; });
        },
      });
    },
    // TextArea, DateSelect and TimeSelect report (event, value) like the MOIS
    // controls (DateSelect a value alone).
    // CompactBooleanField's Yes/No buttons (FieldKit draws them for a controlled yes/no).
    YesNoButtons: ({ yesLabel, noLabel, value, onChange }: Record<string, any>) =>
      h("div", { "data-control": "yesno", "data-value": value ?? "" },
        h("button", { type: "button", onClick: () => onChange("yes") }, yesLabel),
        h("button", { type: "button", onClick: () => onChange("no") }, noLabel)),
    TextArea: control("text", (props, value, event) => (props.onChange as (e: unknown, v: string) => void)?.(event, value)),
    DateSelect: control("date", (props, value) => (props.onChange as (v: string) => void)?.(value)),
    TimeSelect: control("time", (props, value, event) => (props.onChange as (e: unknown, v: string) => void)?.(event, value)),
    FormLogicKit: kit,
    ...(cloneSession ? { cloneFormSessionState: cloneSession } : {}),
  };
  if (realScoring) delete scope.ScoringModule;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compiled};\nreturn { SubformScoring, SubformScoringInner };`)(
    ...Object.values(scope),
  ) as Runtime;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount(component: React.ComponentType<Record<string, unknown>>, props: Record<string, unknown>, data: Record<string, unknown> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(h(Store, { initial: data }, h(component, {
      id: "subform",
      mode: "data-entry",
      isOpen: true,
      hideTriggerButton: true,
      showSummary: false,
      ...props,
    })));
  });
}

function input(selector: string): HTMLInputElement {
  const element = container!.querySelector(selector);
  if (!element) throw new Error(`no element for ${selector}`);
  return element as HTMLInputElement;
}

function typeInto(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function button(text: string): HTMLButtonElement {
  const match = Array.from(container!.querySelectorAll("button")).find((entry) => entry.textContent === text);
  if (!match) throw new Error(`no button "${text}"`);
  return match as HTMLButtonElement;
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  latestState = null;
});

const gatedFields = [
  { id: "gate", label: "Gate", type: "text", placeholder: "gate" },
  {
    id: "detail",
    label: "Detail",
    type: "text",
    placeholder: "detail",
    visibility: { type: "not-equals", controllerId: "gate", value: "hide", match: "all" },
  },
];

describe("visibility", () => {
  it("evaluates rules through FormLogicKit with raw sibling answers and controller kinds", () => {
    const evaluateVisibilityRule = vi.fn((rule: { controllerId: string; value: string }, getValue: (id: string) => unknown) =>
      getValue(rule.controllerId) !== rule.value);
    const runtime = loadRuntime({ evaluateVisibilityRule });
    mount(runtime.SubformScoringInner, { dataEntryConfig: { fields: gatedFields, calculations: [] } }, { gate: "hide" });

    expect(container!.querySelector("input[placeholder=detail]")).toBeNull();
    const [rule, getValue, options] = evaluateVisibilityRule.mock.calls.at(-1)! as unknown as [
      unknown, (id: string) => unknown, { controllerKind: (id: string) => string },
    ];
    expect(rule).toEqual(gatedFields[1].visibility);
    expect(getValue("gate")).toBe("hide");
    expect(options.controllerKind("gate")).toBe("text");

    typeInto(input("input[placeholder=gate]"), "show");
    expect(container!.querySelector("input[placeholder=detail]")).not.toBeNull();
  });

  it("falls back to the local evaluator when FormLogicKit is not loaded", () => {
    const runtime = loadRuntime();
    mount(runtime.SubformScoringInner, {
      dataEntryConfig: {
        fields: [
          gatedFields[0],
          { id: "detail", label: "Detail", type: "text", placeholder: "detail", visibility: { type: "filled", controllerId: "gate" } },
        ],
        calculations: [],
      },
    });
    expect(container!.querySelector("input[placeholder=detail]")).toBeNull();
    typeInto(input("input[placeholder=gate]"), "x");
    expect(container!.querySelector("input[placeholder=detail]")).not.toBeNull();
  });

  it("never draws a hidden field", () => {
    const runtime = loadRuntime();
    mount(runtime.SubformScoringInner, {
      dataEntryConfig: { fields: [{ id: "secret", label: "Secret", type: "text", placeholder: "secret", hidden: true }], calculations: [] },
    });
    expect(container!.querySelector("input[placeholder=secret]")).toBeNull();
  });
});

describe("time fields", () => {
  it("render the MOIS TimeSelect control instead of a plain text box", () => {
    const runtime = loadRuntime();
    mount(runtime.SubformScoringInner, {
      dataEntryConfig: { fields: [{ id: "given_at", label: "Given at", type: "time" }], calculations: [] },
    }, { given_at: "08:30" });

    const time = input("input[data-control=time]");
    expect(time.value).toBe("08:30");
    // FieldKit passes a placeholder only when the field has one, as the
    // exporter does; the MOIS control shows its own mask otherwise.
    expect(time.placeholder).toBe("");
    typeInto(time, "09:15");
    expect(latestState?.field.data.given_at).toBe("09:15");
  });

  it("fills a date-time default of now in the date-time input format", () => {
    const runtime = loadRuntime();
    mount(runtime.SubformScoringInner, {
      dataEntryConfig: { fields: [{ id: "at", label: "At", type: "datetime", defaultValue: "__now" }], calculations: [] },
    });
    expect(latestState?.field.data.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("required fields on Done", () => {
  const fields = [
    { id: "gate", label: "Gate", type: "text", placeholder: "gate" },
    { id: "dose", label: "Dose", type: "text", placeholder: "dose", required: true },
    { id: "route", label: "Route", type: "text", placeholder: "route", required: true },
    // Required, but hidden until the gate says so: never blocks while hidden.
    { id: "reason", label: "Reason", type: "text", required: true, visibility: { type: "equals", controllerId: "gate", value: "yes" } },
  ];

  it("blocks completion, names the missing visible fields, and clears once filled", () => {
    const runtime = loadRuntime();
    const onCommitToParent = vi.fn();
    const onOpenChange = vi.fn();
    mount(runtime.SubformScoringInner, {
      dataEntryConfig: { fields, calculations: [] },
      onCommitToParent,
      onOpenChange,
    });

    click(button("Done"));
    expect(container!.querySelector("[role=alert]")?.textContent).toBe("Dose and Route are required.");
    expect(onCommitToParent).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    typeInto(input("input[placeholder=dose]"), "5 mg");
    expect(container!.querySelector("[role=alert]")?.textContent).toBe("Route is required.");
    typeInto(input("input[placeholder=route]"), "PO");
    expect(container!.querySelector("[role=alert]")).toBeNull();

    click(button("Done"));
    expect(onCommitToParent).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leaves validation to a host that keeps the dialog open itself", () => {
    const runtime = loadRuntime();
    const onComplete = vi.fn(() => false);
    mount(runtime.SubformScoringInner, { dataEntryConfig: { fields, calculations: [] }, onComplete });
    click(button("Done"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(container!.querySelector("[role=alert]")).toBeNull();
  });
});

describe("read-only and host error messages", () => {
  it("disables every input and Done, and never writes defaults into a locked record", () => {
    const runtime = loadRuntime();
    const onCommitToParent = vi.fn();
    mount(runtime.SubformScoringInner, {
      readOnly: true,
      onCommitToParent,
      dataEntryConfig: {
        fields: [
          { id: "note", label: "Note", type: "text", placeholder: "note", defaultValue: "prefilled" },
          { id: "given_at", label: "Given at", type: "time" },
        ],
        calculations: [],
      },
    });

    const fieldset = container!.querySelector("fieldset")!;
    expect(fieldset.disabled).toBe(true);
    expect(fieldset.contains(input("input[placeholder=note]"))).toBe(true);
    expect(input("input[data-control=time]").dataset.readonly).toBe("true");
    expect(latestState?.field.data.note).toBeUndefined();

    const done = button("Done");
    expect(done.disabled).toBe(true);
    click(done);
    expect(onCommitToParent).not.toHaveBeenCalled();
    // Cancel still closes a read-only dialog.
    expect(button("Cancel").disabled).toBe(false);
  });

  it("shows a host errorMessage inside the dialog", () => {
    const runtime = loadRuntime();
    mount(runtime.SubformScoringInner, {
      errorMessage: "Dose is required.",
      dataEntryConfig: { fields: [{ id: "dose", label: "Dose", type: "text" }], calculations: [] },
    });
    expect(container!.querySelector("[role=dialog] [role=alert]")?.textContent).toBe("Dose is required.");
  });
});

describe("closing the dialog (DialogKit RowDialog)", () => {
  const fields = [{ id: "note", label: "Note", type: "text", placeholder: "note" }];

  it("closes an untouched dialog at once", () => {
    const runtime = loadRuntime();
    const onOpenChange = vi.fn();
    mount(runtime.SubformScoringInner, { dataEntryConfig: { fields, calculations: [] }, onOpenChange });
    click(button("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  const scoringConfig = { questions: [{ id: "epds_q1", label: "Question", options: [
    { key: "0", text: "As much as I always could", score: 0 },
    { key: "1", text: "Not quite so much now", score: 1 },
  ] }], totals: [] };

  it("closes an untouched scoring dialog after its empty answers initialize", () => {
    const runtime = loadRuntime(undefined, true);
    const onOpenChange = vi.fn();
    mount(runtime.SubformScoringInner, { mode: "scoring", config: scoringConfig, onOpenChange });
    expect(latestState!.field.data.epds_q1).toMatchObject({ selectedKey: null });
    click(button("Cancel"));
    expect(container!.textContent).not.toContain("Discard changes?");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("warns after selecting a zero-score answer", () => {
    const runtime = loadRuntime(undefined, true);
    const onOpenChange = vi.fn();
    mount(runtime.SubformScoringInner, { mode: "scoring", config: scoringConfig, onOpenChange });
    click(input('input[name="scoring_epds_q1"]'));
    click(button("Cancel"));
    expect(container!.textContent).toContain("Discard changes?");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes after a text edit is reverted to its original blank answer", () => {
    const runtime = loadRuntime();
    const onOpenChange = vi.fn();
    mount(runtime.SubformScoringInner, { dataEntryConfig: { fields, calculations: [] }, onOpenChange });
    typeInto(input("input[placeholder=note]"), "hello");
    typeInto(input("input[placeholder=note]"), "");
    click(button("Cancel"));
    expect(container!.textContent).not.toContain("Discard changes?");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks before a close discards changed answers", () => {
    const runtime = loadRuntime();
    const onOpenChange = vi.fn();
    mount(runtime.SubformScoringInner, { dataEntryConfig: { fields, calculations: [] }, onOpenChange });
    typeInto(input("input[placeholder=note]"), "hello");

    click(button("Cancel"));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(container!.textContent).toContain("Discard changes?");

    click(button("Keep editing"));
    expect(container!.textContent).not.toContain("Discard changes?");
    expect(input("input[placeholder=note]").value).toBe("hello");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    click(button("Cancel"));
    click(button("Discard"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("draws a yes/no as CompactBooleanField's Yes/No buttons and stores the chosen option", () => {
    const runtime = loadRuntime();
    mount(runtime.SubformScoringInner, {
      dataEntryConfig: { fields: [{ id: "pain_now", label: "Pain now", type: "booleanYesNo" }], calculations: [] },
    });
    const yesNo = container!.querySelector("[data-control=yesno]")!;
    expect(Array.from(yesNo.querySelectorAll("button")).map((entry) => entry.textContent)).toEqual(["Yes", "No"]);
    click(button("No"));
    expect(latestState?.field.data.pain_now).toBe("No");
    click(button("Yes"));
    expect(latestState?.field.data.pain_now).toBe("Yes");
  });

  it("stores a date-time answer through the engine-bound DateTimeSelect", async () => {
    const runtime = loadRuntime();
    mount(runtime.SubformScoringInner, {
      dataEntryConfig: { fields: [{ id: "at", label: "At", type: "datetime" }], calculations: [] },
    });
    typeInto(input("input[data-control=datetime]"), "2026-09-27T08:30");
    // The value box reports the control's write on a microtask.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latestState?.field.data.at).toBe("2026-09-27T08:30");
    expect(input("input[data-control=datetime]").value).toBe("2026-09-27T08:30");
  });
});

describe("public wrapper", () => {
  it("clones only on opening, cancels isolated edits, and reopens from the latest parent answers", () => {
    const clone = vi.fn((value: unknown) => JSON.parse(JSON.stringify(value)));
    const runtime = loadRuntime(undefined, false, clone);
    mount(runtime.SubformScoring, {
      isOpen: undefined, hideTriggerButton: false,
      dataEntryConfig: { fields: [{ id: "note", label: "Note", type: "text", placeholder: "note" }], calculations: [] },
    }, { note: "saved" });
    expect(clone).not.toHaveBeenCalled();
    act(() => updateParent(current => { current.field.data.note = "latest"; }));
    expect(clone).not.toHaveBeenCalled();

    click(button("Complete Assessment"));
    expect(clone).toHaveBeenCalled();
    expect(input("input[placeholder=note]").value).toBe("latest");
    typeInto(input("input[placeholder=note]"), "discard me");
    expect(latestState?.field.data.note).toBe("latest");
    click(button("Cancel"));
    click(button("Discard"));
    expect(container?.querySelector('[role="dialog"]')).toBeNull();
    const closedClones = clone.mock.calls.length;
    act(() => updateParent(current => { current.field.data.note = "new parent"; }));
    expect(clone).toHaveBeenCalledTimes(closedClones);
    click(button("Complete Assessment"));
    expect(input("input[placeholder=note]").value).toBe("new parent");
    // A parent update while open must not replace the isolated editing draft.
    typeInto(input("input[placeholder=note]"), "commit me");
    act(() => updateParent(current => { current.field.data.unrelated = "retained"; }));
    expect(input("input[placeholder=note]").value).toBe("commit me");
    click(button("Done"));
    expect(latestState?.field.data.note).toBe("commit me");
    expect(latestState?.field.data.unrelated).toBe("retained");
  });

  it("merges the session into the parent and still runs the host's onCommitToParent", () => {
    const runtime = loadRuntime();
    const onCommitToParent = vi.fn();
    mount(runtime.SubformScoring, {
      onCommitToParent,
      onOpenChange: () => undefined,
      dataEntryConfig: { fields: [{ id: "note", label: "Note", type: "text", placeholder: "note" }], calculations: [] },
    });

    typeInto(input("input[placeholder=note]"), "hello");
    click(button("Done"));

    expect(onCommitToParent).toHaveBeenCalledTimes(1);
    expect((onCommitToParent.mock.calls[0][0] as State).field.data.note).toBe("hello");
    expect(latestState?.field.data.note).toBe("hello");
  });
});
