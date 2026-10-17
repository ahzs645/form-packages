import { describe, expect, it } from "vitest";
import type { BuilderField } from "./index";
import { isObsoleteGridPlaceholder, readPendingConversion } from "./pending-conversion";

const marker = { source: "cerner-powerform", reason: "Not decided yet." };
const grid = (inputType: number): BuilderField => ({
  id: "grid", label: "Grid", type: "table", pendingConversion: marker,
  cernerConfig: { version: 1, sourceKind: "powerform", formName: "", sectionName: "", inputType, inputRefSeq: 0, preferences: {}, importStatus: "exact" },
} as BuilderField);

describe("readPendingConversion", () => {
  it("ignores the placeholder an older import left on a PowerForm grid", () => {
    for (const inputType of [14, 17, 19]) {
      expect(isObsoleteGridPlaceholder(grid(inputType))).toBe(true);
      expect(readPendingConversion(grid(inputType))).toBeUndefined();
    }
  });

  it("keeps every other placeholder", () => {
    expect(readPendingConversion(grid(2))).toEqual(marker);
    const summary = { source: "chart-summary", reason: "MOIS has no equivalent." };
    expect(readPendingConversion({ id: "s", label: "S", type: "textarea", pendingConversion: summary })).toEqual(summary);
    expect(readPendingConversion({ id: "t", label: "T", type: "text" })).toBeUndefined();
  });
});
