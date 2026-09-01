import type { BuilderField } from "@webforms/form-model";
import { describe, expect, it } from "vitest";

import { formatTerraCompatibilityMessage, getTerraCompatibilityReport } from "./compatibility";

const field = (overrides: Partial<BuilderField>): BuilderField =>
  ({ id: "f1", label: "Field", type: "text", ...overrides }) as BuilderField;

describe("getTerraCompatibilityReport", () => {
  it("counts supported and unsupported fields and lists the controls needed", () => {
    const report = getTerraCompatibilityReport([
      field({ id: "a", label: "Reason", type: "textarea" }),
      field({ id: "b", label: "Visit date", type: "date" }),
      field({ id: "c", label: "Sign here", type: "signature" }),
    ]);

    expect(report.supportedCount).toBe(2);
    expect(report.unsupportedCount).toBe(1);
    expect(report.controls).toEqual(["date", "textarea"]);
    expect(report.items[2]).toMatchObject({
      fieldId: "c",
      supported: false,
      control: null,
    });
    expect(report.items[2].reason).toMatch(/Signature/);
  });

  it("summarises a fully supported form in one line", () => {
    const report = getTerraCompatibilityReport([field({ type: "text" })]);
    expect(formatTerraCompatibilityMessage(report)).toBe(
      "All 1 fields render with Terra components.",
    );
  });

  it("names each unsupported field with its reason", () => {
    const report = getTerraCompatibilityReport([
      field({ id: "s", label: "Signature", type: "signature" }),
      field({ id: "m", label: "Matrix", type: "matrix" }),
    ]);
    const message = formatTerraCompatibilityMessage(report);
    expect(message).toContain("2 of 2 fields cannot render with Terra:");
    expect(message).toContain("• Signature:");
    expect(message).toContain("• Matrix:");
  });
});
