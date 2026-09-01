// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NHFORMS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NHFORMS_DIR, "ScaleField", "index.jsx"), "utf8");

describe("ScaleField controlled contract", () => {
  it("delegates a normalized answer without initializing ActiveData", () => {
    let choiceProps: Record<string, any> = {};
    const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
    const Fluent = {
      Stack: passthrough,
      Label: passthrough,
      Text: passthrough,
      StackItem: passthrough,
      TooltipHost: passthrough,
      ChoiceGroup: (props: Record<string, any>) => {
        choiceProps = props;
        return React.createElement("div", { "data-choice-group": true });
      },
    };
    const setFieldData = vi.fn();
    const useActiveData = () => [{}, setFieldData];
    const useTheme = () => ({ semanticColors: { bodyBackground: "white", bodySubtext: "gray" } });
    const compiled = Babel.transform(source, { presets: ["react"], filename: "ScaleField.jsx" }).code ?? "";
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const ScaleField = new Function(
      "React",
      "Fluent",
      "useActiveData",
      "useTheme",
      `${compiled}; return ScaleField;`,
    )(React, Fluent, useActiveData, useTheme) as React.ComponentType<any>;
    const onChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(React.createElement(ScaleField, {
      fieldId: "nested_scale",
      label: "Nested scale",
      options: [
        { value: 1, label: "Low" },
        { value: 2, label: "Medium" },
        { value: 3, label: "High", description: "High detail" },
      ],
      value: { selectedKey: "2", value: 2, response: "Medium" },
      onChange,
      hideLabel: true,
    })));

    expect(setFieldData).not.toHaveBeenCalled();
    expect(choiceProps.selectedKey).toBe("2");
    act(() => choiceProps.onChange({}, { key: "3" }));
    expect(onChange).toHaveBeenCalledWith(
      {
        selectedKey: "3",
        value: 3,
        response: "High",
        detailResponse: "High detail",
      },
      expect.objectContaining({ key: "3" }),
      {},
    );

    act(() => root.unmount());
  });
});
