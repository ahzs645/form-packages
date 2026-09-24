import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import * as PDFLib from "@cantoo/pdf-lib";

const source = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../PdfRegenerator/index.jsx"),
  "utf8",
);

let helper: ((input: {
  doc: PDFLib.PDFDocument;
  pdfFields: PDFLib.PDFField[];
  textFlowMaps: Array<{ sourceFieldId: string; fieldIds: string[]; label?: string; overflow?: "block" | "truncate" }>;
  formData: Record<string, unknown>;
  map: Map<string, string>;
  PDFLib: typeof PDFLib;
}) => Promise<Map<string, string>>) | undefined;

function buildTextFlowValues() {
  if (helper) return helper;
  const compiled = Babel.transform(source, { presets: ["react"], filename: "PdfRegenerator/index.jsx" }).code ?? "";
  // The runtime loads this same self-contained source into the MOIS scope.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function("React", "Fluent", `${compiled}; return _buildTextFlowValues;`);
  helper = factory(
    { useMemo: () => undefined, useState: () => undefined, useCallback: () => undefined },
    {},
  );
  return helper!;
}

async function createThreeLinePdf() {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  const widths = [120, 240, 240];
  const ids = ["top", "middle", "bottom"];
  ids.forEach((id, index) => {
    form.createTextField(id).addToPage(page, {
      x: 50,
      y: 150 - index * 20,
      width: widths[index],
      height: 14,
    });
  });
  return { doc, form, ids };
}

describe("PdfRegenerator text continuation", { timeout: 30000 }, () => {
  it("fills three independent PDF fields in order from one answer", async () => {
    const { doc, form, ids } = await createThreeLinePdf();
    const answer = "Continue the bowel regimen after the first dose and reassess symptoms before giving additional medication.";
    const values = await buildTextFlowValues()({
      doc,
      pdfFields: form.getFields(),
      textFlowMaps: [{ sourceFieldId: "combined", fieldIds: ids }],
      formData: { combined: answer },
      map: new Map(ids.map((id) => [id, "combined"])),
      PDFLib,
    });

    expect(ids.map((id) => values.get(id)).join(" ")).toBe(answer);
    expect(values.get("top")!.length).toBeLessThan(values.get("middle")!.length);
    ids.forEach((id) => form.getTextField(id).setText(values.get(id)!));
    const reopened = await PDFLib.PDFDocument.load(await doc.save());
    ids.forEach((id) => expect(reopened.getForm().getTextField(id).getText()).toBe(values.get(id)));
  });

  it("preserves explicit line breaks and rejects text beyond the last line", async () => {
    const { doc, form, ids } = await createThreeLinePdf();
    const input = {
      doc,
      pdfFields: form.getFields(),
      textFlowMaps: [{ sourceFieldId: "combined", fieldIds: ids }],
      map: new Map(ids.map((id) => [id, "combined"])),
      PDFLib,
    };
    const values = await buildTextFlowValues()({ ...input, formData: { combined: "First line\nSecond line" } });
    expect(ids.map((id) => values.get(id))).toEqual(["First line", "Second line", ""]);

    await expect(buildTextFlowValues()({
      ...input,
      formData: { combined: "long ".repeat(300) },
    })).rejects.toThrow(/about \d+ characters longer than its 3 PDF lines/);
  });

  it("names the field when blocking and cuts with a visible mark when set to truncate", async () => {
    const { doc, form, ids } = await createThreeLinePdf();
    const input = {
      doc,
      pdfFields: form.getFields(),
      map: new Map(ids.map((id) => [id, "combined"])),
      PDFLib,
      formData: { combined: "Reassess symptoms and continue the regimen. ".repeat(12) },
    };
    await expect(buildTextFlowValues()({
      ...input,
      textFlowMaps: [{ sourceFieldId: "combined", fieldIds: ids, label: "Additional orders" }],
    })).rejects.toThrow('"Additional orders" is about');

    const values = await buildTextFlowValues()({
      ...input,
      textFlowMaps: [{ sourceFieldId: "combined", fieldIds: ids, overflow: "truncate" }],
    });
    expect(values.get("bottom")!.endsWith(" \u2026")).toBe(true);
    ids.forEach((id) => form.getTextField(id).setText(values.get(id)!));
  });
});
