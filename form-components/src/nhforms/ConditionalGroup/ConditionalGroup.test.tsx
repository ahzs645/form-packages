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
const FluentStub = {
  Stack: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Label: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
};

function loadConditionalGroup(): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "produce",
    "useTheme",
    "CompactBooleanField",
    `${compiled};\nreturn ConditionalGroup;`
  );
  return factory(
    React,
    FluentStub,
    () => React.useContext(ActiveDataContext),
    () => ({}),
    produce,
    () => ({ isInverted: false }),
    ({ fieldId, label }: { fieldId: string; label: string }) => (
      <button data-controller-field-id={fieldId}>{label}</button>
    )
  );
}

function renderGroup(value: boolean, showController: boolean) {
  const ConditionalGroup = loadConditionalGroup();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const data = { field: { data: { completed: value } } };

  act(() => {
    root.render(
      <ActiveDataContext.Provider value={[data, () => undefined]}>
        <ConditionalGroup
          id="details"
          controllerLabel="Completed"
          controllerFieldId="completed"
          showWhen="yes"
          showController={showController}
          title="Details"
        >
          <span data-testid="details-content">Details content</span>
        </ConditionalGroup>
      </ActiveDataContext.Provider>
    );
  });

  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}

describe("ConditionalGroup controller ownership", () => {
  it("renders no duplicate controller or empty card when an external controller closes the group", () => {
    const harness = renderGroup(false, false);

    expect(harness.container.querySelector("[data-conditional-group='details']")).toBeNull();
    expect(harness.container.querySelector("[data-controller-field-id='completed']")).toBeNull();
    harness.unmount();
  });

  it("renders only the content when an external controller opens the group", () => {
    const harness = renderGroup(true, false);

    expect(harness.container.querySelector("[data-conditional-group='details']")).not.toBeNull();
    expect(harness.container.querySelector("[data-testid='details-content']")).not.toBeNull();
    expect(harness.container.querySelector("[data-controller-field-id='completed']")).toBeNull();
    expect(harness.container.textContent).toContain("Details");
    harness.unmount();
  });

  it("keeps the controller header when the group owns the controller", () => {
    const harness = renderGroup(false, true);

    expect(harness.container.querySelector("[data-conditional-group='details']")).not.toBeNull();
    expect(harness.container.querySelector("[data-controller-field-id='completed']")?.textContent).toBe("Completed");
    harness.unmount();
  });
});
