/**
 * Regression tests for the shared __nhAuth authorship runtime and the
 * authorship-aware nhforms components.
 *
 * Two layers:
 *  1. Engine semantics — lock-on-edit and lock-on-save (pending → promote).
 *  2. Real-MOIS load — each authorship component, with the runtime prepended and
 *     IIFE-wrapped exactly as shimmed MOIS does (lib/mois-export/load-simulation.ts
 *     `wrapComponentSource`), transpiled and executed through the same
 *     `Function(React, Fabric, …)` wrapper the renderer uses. Catches dormant-global
 *     ReferenceErrors and declaration collisions without depending on a local SMOIS.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React from "react";

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeSource = fs.readFileSync(path.join(NH, "_shared", "authorship-runtime.js"), "utf8");

// Load the runtime into an isolated fake `window` and return its __nhAuth.
function loadRuntime(): any {
  const win: any = {};
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function("window", runtimeSource)(win);
  return win.__nhAuth;
}

const sdFor = (id: number, name: string) => ({
  auth: { userProfileId: id },
  userProfile: { userProfileId: id, identity: { fullName: name } },
});
const FIELD = { scope: "field" as const, fieldId: "note", componentId: "AuthorshipField" };

describe("__nhAuth engine — lock-on-edit", () => {
  let A: any;
  beforeEach(() => {
    A = loadRuntime();
  });

  it("claims a field on edit and persists under field.data.__authorship", () => {
    const draft: any = { field: { data: { note: "obs by A" } } };
    const sdA = sdFor(1, "Dr A");
    expect(A.claim(draft, sdA, FIELD, "obs by A", { enabled: true, lockOn: "edit" }, { now: "2026-06-29T10:00:00Z" })).toBe(true);
    expect(draft.field.data.__authorship.claims["field:note"]).toBeTruthy();
    expect(draft.field.data.__authorship.claims["field:note"].status).toBe("locked");
  });

  it("is editable for the owner and locked for others; refuses overwrite", () => {
    const draft: any = { field: { data: { note: "obs by A" } } };
    A.claim(draft, sdFor(1, "Dr A"), FIELD, "obs by A", { enabled: true, lockOn: "edit" }, { now: "2026-06-29T10:00:00Z" });

    const lockA = A.lockInfo(draft, sdFor(1, "Dr A"), FIELD, { ownerId: 1, ownerName: "Dr A", now: "2026-06-29T11:00:00Z" });
    expect(lockA.locked).toBe(false);

    const lockB = A.lockInfo(draft, sdFor(2, "Nurse B"), FIELD, { ownerId: 2, ownerName: "Nurse B", now: "2026-06-29T11:00:00Z" });
    expect(lockB.locked).toBe(true);
    expect(lockB.note).toContain("Dr A");

    expect(A.claim(draft, sdFor(2, "Nurse B"), FIELD, "obs by B", { enabled: true, lockOn: "edit" }, { now: "2026-06-29T11:00:00Z" })).toBe(false);
  });

  it("expires the owner's editable window after editableWindowHours", () => {
    const draft: any = { field: { data: { note: "x" } } };
    A.claim(draft, sdFor(1, "Dr A"), FIELD, "x", { enabled: true, lockOn: "edit", editableWindowHours: 72 }, { now: "2026-06-29T10:00:00Z" });
    const expired = A.lockInfo(draft, sdFor(1, "Dr A"), FIELD, { ownerId: 1, ownerName: "Dr A", now: "2026-07-03T11:00:00Z" });
    expect(expired.locked).toBe(true);
    expect(expired.expired).toBe(true);
  });

  it("does not claim an empty value", () => {
    const draft: any = { field: { data: {} } };
    expect(A.claim(draft, sdFor(1, "Dr A"), { scope: "field", fieldId: "x" }, "", { enabled: true, lockOn: "edit" }, { now: "2026-06-29T10:00:00Z" })).toBe(false);
  });
});

describe("__nhAuth engine — lock-on-save (pending → promote)", () => {
  let A: any;
  beforeEach(() => {
    A = loadRuntime();
  });

  it("an edit creates a non-enforced pending claim that does NOT lock others", () => {
    const draft: any = { field: { data: { note: "draft by A" } } };
    A.claim(draft, sdFor(1, "Dr A"), FIELD, "draft by A", { enabled: true, lockOn: "save" }, { now: "2026-06-29T10:00:00Z" });
    expect(draft.field.data.__authorship.claims["field:note"].status).toBe("pending");

    // Pending is not enforced — another user still sees it editable.
    const lockB = A.lockInfo(draft, sdFor(2, "Nurse B"), FIELD, { ownerId: 2, ownerName: "Nurse B", now: "2026-06-29T11:00:00Z" });
    expect(lockB.locked).toBe(false);
  });

  it("save promotes the author's pending claim to locked; then it enforces", () => {
    const state: any = { field: { data: { note: "draft by A" } }, setFormData: () => {} };
    A.claim(state, sdFor(1, "Dr A"), FIELD, "draft by A", { enabled: true, lockOn: "save" }, { now: "2026-06-29T10:00:00Z" });

    const prepared = A.prepareSave(state, sdFor(1, "Dr A"), "save");
    expect(prepared.changed).toBe(true);
    expect(prepared.formData.__authorship.claims["field:note"].status).toBe("locked");

    // After promotion, another user is locked out.
    const promotedState = prepared.nextState;
    const lockB = A.lockInfo(promotedState, sdFor(2, "Nurse B"), FIELD, { ownerId: 2, ownerName: "Nurse B", now: "2026-06-29T12:00:00Z" });
    expect(lockB.locked).toBe(true);
  });

  it("a save by a different user does not promote another author's pending claim", () => {
    const state: any = { field: { data: { note: "draft by A" } } };
    A.claim(state, sdFor(1, "Dr A"), FIELD, "draft by A", { enabled: true, lockOn: "save" }, { now: "2026-06-29T10:00:00Z" });
    const prepared = A.prepareSave(state, sdFor(2, "Nurse B"), "save");
    expect(prepared.changed).toBe(false);
  });

  it("sign promotes a lockOn:'save' pending claim to signed (terminal)", () => {
    const state: any = { field: { data: { note: "draft by A" } } };
    A.claim(state, sdFor(1, "Dr A"), FIELD, "draft by A", { enabled: true, lockOn: "save" }, { now: "2026-06-29T10:00:00Z" });
    const prepared = A.prepareSave(state, sdFor(1, "Dr A"), "sign");
    expect(prepared.formData.__authorship.claims["field:note"].status).toBe("signed");
  });

  it("a save action does NOT promote a lockOn:'sign' pending claim (waits for sign)", () => {
    const state: any = { field: { data: { note: "draft by A" } } };
    A.claim(state, sdFor(1, "Dr A"), FIELD, "draft by A", { enabled: true, lockOn: "sign" }, { now: "2026-06-29T10:00:00Z" });
    const onSave = A.prepareSave(state, sdFor(1, "Dr A"), "save");
    expect(onSave.changed).toBe(false);
    const onSign = A.prepareSave(state, sdFor(1, "Dr A"), "sign");
    expect(onSign.formData.__authorship.claims["field:note"].status).toBe("signed");
  });
});

// --- Real-MOIS load fidelity ------------------------------------------------

// Replicates lib/mois-export/load-simulation.ts wrapComponentSource: each
// component runs inside its own IIFE so top-level declarations are isolated.
function wrapComponentSource(source: string, exportNames: string[]): string {
  const decl = `var ${exportNames.join(", ")};`;
  const captured = exportNames.map((n) => `${n}: (typeof ${n} !== "undefined" ? ${n} : undefined)`).join(", ");
  const assign = exportNames.map((n) => `if (__componentExports.${n} !== undefined) { ${n} = __componentExports.${n}; }`).join("\n");
  return `${decl}\n(() => {\n  const __componentExports = (() => {\n${source}\n    return { ${captured} };\n  })();\n${assign}\n})();\n`;
}

// Verbatim destructuring preamble the real loader injects from the 8 namespaces.
const PRELUDE = `
let { Action, ButtonBar, Column, DateSelect, DateTimeSelect, Form, Header, Heading, LayoutItem, Linear, LinkToMois, ListSelection, Markdown, NameBlock, Numeric, OptionChoice, Row, SaveButton, SaveStatus, Section, SimpleCodeChecklist, SimpleCodeSelect, SubForm, SubmitButton, SubTitle, TextArea, TimeSelect, Title, } = MoisControl;
let { getDateString, getTimeString, getDateTimeString, parseDate, produce, refresh, saveDraft, saveSubmit, sign, signSubmit, } = MoisFunction;
let { useActiveData, useCodeList, useMutation, useOnLoad, useOnRefresh, usePrinting, useQuery, useSection, useSourceData, useTempData, useTheme, } = MoisHooks;
`.replace(/\n/g, " ");

function namespaceStub(name: string): any {
  return new Proxy(
    {},
    {
      get: (_t, p) => (p === Symbol.toPrimitive || p === "toString" ? () => `[${name}]` : function stub() { return stub; }),
    }
  );
}

const LOAD_COMPONENTS: Record<string, string[]> = {
  AuthorshipField: ["AuthorshipField"],
  ObservationPanelEditor: ["ObservationPanelEditor"],
  EditableTable: ["EditableTable", "EditableTableSchema", "createTableColumns"],
  UnsavedChangesGuard: ["UnsavedChangesGuard"],
  SaveOnClose: ["SaveOnClose", "useSaveOnClose"],
};

describe("authorship components load in the real-MOIS wrapper", () => {
  it("transpile + execute all authorship components (runtime prepended, IIFE-wrapped) with no ReferenceError", () => {
    const componentNames = Object.keys(LOAD_COMPONENTS);
    let assembled =
      "let Query=null; let InitialData={}; let Schema=null;" + PRELUDE +
      " const Identity = { name: 'verify', components: " + JSON.stringify(componentNames) + " }; ";
    for (const name of componentNames) {
      const source = runtimeSource + "\n" + fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");
      assembled += wrapComponentSource(source, LOAD_COMPONENTS[name]) + "\n";
    }
    assembled += `
      const FormComponent = () => React.createElement(Section, { sectionNum: 0 },
        React.createElement(AuthorshipField, { fieldId: "note", label: "Note", kind: "textarea" }),
        React.createElement(ObservationPanelEditor, { id: "vitals", fieldId: "vitals", rows: [{ id: "hr", label: "HR", type: "numeric" }] }),
        React.createElement(EditableTable, { id: "meds", columns: [{ id: "name", title: "Name", type: "text" }] }),
        React.createElement(UnsavedChangesGuard, {}),
        React.createElement(SaveOnClose, {})
      );
    `;

    const code = Babel.transform(assembled, { presets: ["react", "typescript"], filename: "form.tsx" }).code;
    expect(code, "babel transform should succeed (no duplicate-declaration / syntax error)").toBeTruthy();

    const hadWindow = "window" in globalThis;
    const prevWindow = (globalThis as any).window;
    (globalThis as any).window = {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      const factory = Function(
        '"use strict";return (function(React,Fabric,Fluent,MoisControl,MoisFunction,MoisActions,MoisHooks,Mois){' +
          code +
          ";return({ FormComponent: FormComponent, AuthorshipField: typeof AuthorshipField !== 'undefined' ? AuthorshipField : null, ObservationPanelEditor: typeof ObservationPanelEditor !== 'undefined' ? ObservationPanelEditor : null, EditableTable: typeof EditableTable !== 'undefined' ? EditableTable : null, UnsavedChangesGuard: typeof UnsavedChangesGuard !== 'undefined' ? UnsavedChangesGuard : null, SaveOnClose: typeof SaveOnClose !== 'undefined' ? SaveOnClose : null })})"
      )();
      const result = factory(
        React,
        namespaceStub("Fabric"),
        namespaceStub("Fluent"),
        namespaceStub("MoisControl"),
        namespaceStub("MoisFunction"),
        namespaceStub("MoisHooks"),
        namespaceStub("MoisActions"),
        {}
      );

      expect(typeof result.FormComponent).toBe("function");
      expect(typeof result.AuthorshipField).toBe("function");
      expect(typeof result.ObservationPanelEditor).toBe("function");
      expect(typeof result.EditableTable).toBe("function");
      expect(typeof result.UnsavedChangesGuard).toBe("function");
      expect(typeof result.SaveOnClose).toBe("function");
      // The runtime IIFE installs __nhAuth at module-eval time.
      expect((globalThis as any).window.__nhAuth, "window.__nhAuth should be installed by the inlined runtime").toBeTruthy();
      expect(typeof (globalThis as any).window.__nhAuth.lockInfo).toBe("function");
      expect(typeof (globalThis as any).window.__nhAuth.prepareSave).toBe("function");
    } finally {
      if (hadWindow) (globalThis as any).window = prevWindow;
      else delete (globalThis as any).window;
    }
  });
});
