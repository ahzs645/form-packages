// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { produce } from "immer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "index.jsx"),
  "utf8"
);
const ActiveDataContext = React.createContext<any>(null);
const FluentStub = new Proxy({}, { get: () => () => null });

function loadConditionalReadOnly(): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "produce",
    `${compiled};\nreturn ConditionalReadOnly;`
  );
  return factory(
    React,
    FluentStub,
    () => React.useContext(ActiveDataContext),
    () => ({}),
    produce
  );
}

function renderRule(args: {
  value?: unknown;
  action?: "set-readonly" | "clear-readonly";
  protectionMode?: "readOnly" | "disabled" | "both";
  initiallyProtected?: boolean;
}) {
  const ConditionalReadOnly = loadConditionalReadOnly();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const data = { field: { data: { controller: args.value } } };

  act(() => {
    root.render(
      <ActiveDataContext.Provider value={[data, () => undefined]}>
        <ConditionalReadOnly
          conditions={[{ controllerFieldId: "controller", type: "boolean-no" }]}
          action={args.action}
          protectionMode={args.protectionMode}
        >
          <div>
            <input
              data-testid="target"
              readOnly={args.initiallyProtected}
              disabled={args.initiallyProtected}
            />
          </div>
        </ConditionalReadOnly>
      </ActiveDataContext.Provider>
    );
  });

  return {
    container,
    input: container.querySelector("input") as HTMLInputElement,
    unmount: () => act(() => root.unmount()),
  };
}

describe("ConditionalReadOnly", () => {
  it("sets both readOnly and disabled without hiding the target", () => {
    const harness = renderRule({ value: false });

    expect(harness.input).not.toBeNull();
    expect(harness.input.readOnly).toBe(true);
    expect(harness.input.disabled).toBe(true);
    expect(harness.container.querySelector("fieldset[data-conditional-read-only='true']")).not.toBeNull();
    harness.unmount();
  });

  it("can apply readOnly without disabling the control", () => {
    const harness = renderRule({ value: false, protectionMode: "readOnly" });

    expect(harness.input.readOnly).toBe(true);
    expect(harness.input.disabled).toBe(false);
    expect(harness.container.querySelector("fieldset")).toBeNull();
    harness.unmount();
  });

  it("clears baseline protection only while the condition matches", () => {
    const editable = renderRule({ value: false, action: "clear-readonly", initiallyProtected: true });
    expect(editable.input.readOnly).toBe(false);
    expect(editable.input.disabled).toBe(false);
    editable.unmount();

    const protectedWhileBlank = renderRule({ action: "clear-readonly", initiallyProtected: true });
    expect(protectedWhileBlank.input.readOnly).toBe(true);
    expect(protectedWhileBlank.input.disabled).toBe(true);
    protectedWhileBlank.unmount();
  });
});
