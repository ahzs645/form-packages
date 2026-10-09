import { describe, expect, it } from "vitest";

import type { BuilderField } from "./index";
import type { CompositeField } from "./layout";
import { readDefaultAnswer } from "./defaults";
import {
  convertYesNoChoice,
  convertYesNoChoiceInDocument,
  yesNoAnswerOf,
  yesNoChoiceConversionBlocker,
  yesNoOptionComponents,
} from "./yes-no-choice";

const composite = (): CompositeField => ({
  id: "composite-choice-answer_3",
  type: "choice",
  label: "Status of medical order",
  subgroupId: null,
  components: [
    { fieldId: "answer_3", role: "option", optionValue: "signed", optionLabel: "Signed" },
    { fieldId: "answer_4", role: "option", optionValue: "declined_signing", optionLabel: "Declined" },
  ],
  componentSnapshots: [
    { id: "answer_3", type: "booleanSingle", label: "Box 1", pdfFieldAliases: ["Box1"] },
    { id: "answer_4", type: "booleanSingle", label: "Box 2", pdfFieldAliases: ["Box2"] },
  ],
});

const choice = (): BuilderField => ({
  id: "composite-choice-answer_3",
  type: "choice",
  label: "Status of medical order",
  required: false,
  pdfFieldAliases: ["Box1", "Box2"],
  options: [
    { label: "Pass", value: "signed" },
    { label: "Defect", value: "declined_signing" },
  ],
  choiceStyle: "buttons",
  booleanNeutralMode: "cycle",
  defaultAnswer: { kind: "literal", value: "declined_signing" },
} as BuilderField);

describe("yesNoAnswerOf", () => {
  it("reads every stored spelling of a Yes/No answer", () => {
    expect([true, "Yes", "Y", 1, { code: "Y", system: "MOIS-YESNO" }].map(yesNoAnswerOf)).toEqual(["yes", "yes", "yes", "yes", "yes"]);
    expect([false, "no", "N", 0, { code: "N" }].map(yesNoAnswerOf)).toEqual(["no", "no", "no", "no", "no"]);
    expect([null, "", "maybe", 2].map(yesNoAnswerOf)).toEqual([null, null, null, null]);
  });
});

describe("convertYesNoChoice", () => {
  it("turns a two-box combined choice into a Yes/No that prints to the same boxes", () => {
    const conversion = convertYesNoChoice(choice(), "booleanYesNo", composite())!;
    expect(conversion.field).toMatchObject({
      type: "booleanYesNo",
      booleanLabels: { on: "Pass", off: "Defect" },
      options: null,
      booleanNeutralMode: "cycle",
      pdfFieldAliases: ["Box1", "Box2"],
    });
    expect(readDefaultAnswer(conversion.field, { shape: "field" })).toEqual({ kind: "literal", value: false });
    // Same members, same PDF boxes; only the value each box prints by changes.
    expect(conversion.composite!.components).toEqual([
      { fieldId: "answer_3", role: "option", optionValue: "yes", optionLabel: "Pass" },
      { fieldId: "answer_4", role: "option", optionValue: "no", optionLabel: "Defect" },
    ]);
    expect(conversion.composite!.componentSnapshots).toEqual(composite().componentSnapshots);
    expect(yesNoOptionComponents(conversion.composite)).not.toBeNull();
    expect(conversion.remapConditionValue("signed")).toBe("yes");
    expect(conversion.remapConditionValue("Defect")).toBe("no");
  });

  it("turns the Yes/No back into a choice with its labels and the same boxes", () => {
    const yesNo = convertYesNoChoice(choice(), "booleanYesNo", composite())!;
    const back = convertYesNoChoice(yesNo.field, "choice", yesNo.composite)!;
    expect(back.field).toMatchObject({
      type: "choice",
      options: [{ label: "Pass", value: "yes" }, { label: "Defect", value: "no" }],
      choiceStyle: "buttons",
      booleanLabels: null,
      booleanNeutralMode: "cycle",
    });
    expect(readDefaultAnswer(back.field, { shape: "field" })).toEqual({ kind: "literal", value: "no" });
    expect(back.composite!.components.map((component) => [component.fieldId, component.optionValue, component.optionLabel])).toEqual([
      ["answer_3", "yes", "Pass"],
      ["answer_4", "no", "Defect"],
    ]);
    expect(back.remapConditionValue("true")).toBe("yes");
  });

  it("gives a Yes/No without boxes options valued by their labels", () => {
    const field = { id: "q", type: "booleanYesNo", label: "Q", booleanLabels: { on: "Normal", off: "Abnormal" }, choiceStyle: "checkbox" } as BuilderField;
    const back = convertYesNoChoice(field, "choice")!;
    expect(back.field.options).toEqual([{ label: "Normal", value: "Normal" }, { label: "Abnormal", value: "Abnormal" }]);
    // A multiple-answer look can't hold a Yes/No; it takes the Yes/No's own look.
    expect(back.field.choiceStyle).toBe("buttons");
    expect(back.composite).toBeNull();
  });

  it("refuses a choice a Yes/No can't hold", () => {
    expect(yesNoChoiceConversionBlocker({ ...choice(), options: ["A", "B", "C"] }, "booleanYesNo")).toMatch(/exactly two/);
    expect(yesNoChoiceConversionBlocker({ ...choice(), choiceStyle: "checkbox" }, "booleanYesNo")).toMatch(/several answers/);
    expect(yesNoChoiceConversionBlocker({ ...choice(), codeSystem: "MOIS-YESNO" }, "booleanYesNo")).toMatch(/code system/);
    expect(yesNoChoiceConversionBlocker({ ...choice(), options: [{ label: "A", score: 1 }, "B"] }, "booleanYesNo")).toMatch(/scores/);
    const withOther = composite();
    withOther.components.push({ fieldId: "answer_5", role: "other", optionValue: "other" });
    expect(convertYesNoChoice(choice(), "booleanYesNo", withOther)).toBeNull();
  });
});

describe("convertYesNoChoiceInDocument", () => {
  it("converts the field and its boxes and rewrites rules that compare its answer", () => {
    const document = {
      fields: [
        choice(),
        { id: "follow-up", type: "text", label: "Why", visibility: { type: "equals", controllerId: "composite-choice-answer_3", value: "declined_signing" } } as BuilderField,
      ],
      drafts: [{ compositeFields: [composite()] }],
    };
    expect(convertYesNoChoiceInDocument(document, "composite-choice-answer_3", "booleanYesNo")).toBe(true);
    expect(document.fields[0].type).toBe("booleanYesNo");
    expect(document.fields[1].visibility).toMatchObject({ value: "no" });
    expect(document.drafts[0].compositeFields[0].components.map((component) => component.optionValue)).toEqual(["yes", "no"]);
    expect(convertYesNoChoiceInDocument(document, "composite-choice-answer_3", "choice")).toBe(true);
    expect(document.fields[0].options).toEqual([{ label: "Pass", value: "yes" }, { label: "Defect", value: "no" }]);
    expect(document.fields[1].visibility).toMatchObject({ value: "no" });
  });
});
