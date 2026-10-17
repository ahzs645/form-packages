import { describe, expect, it } from "vitest";

import {
  CHOICE_LAYOUT_CASES,
  HELP_POSITION_CASES,
  LABEL_POSITION_CASES,
  MOIS_HOT_KEY_CASES,
  MOIS_OPTION_HOT_KEY_CASES,
  NUMBER_FORMAT_CASES,
  OPTION_DISPLAY_ORDER_CASES,
} from "./field-settings.cases";
import {
  choiceLayoutPatch,
  helpPositionPatch,
  labelPositionPatch,
  moisHotKeysPatch,
  moisOptionSizeOf,
  numberFormatPatch,
  optionDisplayOrderPatch,
  optionsInDisplayOrder,
  readChoiceLayout,
  readHelpPosition,
  readLabelPosition,
  readMoisHotKeys,
  readMoisOptionHotKey,
  readNumberFormat,
  readOptionDisplayOrder,
  roundToDecimalPlaces,
  shuffleForDisplay,
  writeChoiceLayout,
  writeHelpPosition,
  writeLabelPosition,
  writeMoisHotKeys,
  writeMoisOptionHotKey,
  writeNumberFormat,
  writeOptionDisplayOrder,
} from "./field-settings";
import { normalizeChoiceStyle, readChoiceStyle, choiceDisplayOf, choiceStyleFor } from "./field-types";
import { exclusiveAnswerValues } from "./option-rules";

const table = <T,>(cases: Array<{ name: string; field: unknown; expected: T }>) => cases.map((entry) => [entry.name, entry] as const);

describe("decimal places", () => {
  it.each(table(NUMBER_FORMAT_CASES))("reads: %s", (_name, entry) => {
    expect(readNumberFormat(entry.field)).toEqual(entry.expected);
  });

  it("writes a number's decimals into numberConfig and switches an integer to a decimal", () => {
    const field = { id: "a", type: "number", numberConfig: { typeNumber: "number" as const, suffix: "kg" } };
    const written = writeNumberFormat(field, { decimalPlaces: 1 });
    expect(written.numberConfig).toEqual({ typeNumber: "number", suffix: "kg", decimalPlaces: 1 });
    expect(readNumberFormat(written)).toEqual({ decimalPlaces: 1, source: "numberConfig" });
    expect(writeNumberFormat(written, {}).numberConfig).toEqual({ typeNumber: "number", suffix: "kg" });
  });

  it("writes a computed field's decimals into both formula stores and drops the AlayaCare copy", () => {
    const field = {
      id: "c",
      type: "computed",
      computedConfig: { expression: "a+b", precision: 1 },
      calculatedValue: { id: "c", label: "C", expression: "a+b", precision: 1 },
      alayaCareConfig: { fieldType: "score", scoreDecimals: 1 },
    };
    const patch = numberFormatPatch(field, { decimalPlaces: 2 });
    expect(patch).toEqual({
      computedConfig: { expression: "a+b", precision: 2 },
      calculatedValue: { id: "c", label: "C", expression: "a+b", precision: 2 },
      alayaCareConfig: { fieldType: "score" },
    });
    expect(readNumberFormat({ ...field, ...patch })).toEqual({ decimalPlaces: 2, source: "precision" });
  });

  it("rounds half away from zero", () => {
    expect(roundToDecimalPlaces(2.345, 2)).toBe(2.35);
    expect(roundToDecimalPlaces(-2.345, 2)).toBe(-2.35);
    expect(roundToDecimalPlaces(2.345, undefined)).toBe(2.345);
  });
});

describe("answer display order", () => {
  it.each(table(OPTION_DISPLAY_ORDER_CASES))("reads: %s", (_name, entry) => {
    expect(readOptionDisplayOrder(entry.field)).toBe(entry.expected);
  });

  it("writes the neutral order with shuffleOptions and the Cerner flag as mirrors", () => {
    const cerner = { id: "a", type: "choice", cernerConfig: { version: 1 } };
    const sorted = writeOptionDisplayOrder(cerner, "alphabetic");
    expect(sorted).toMatchObject({ optionDisplayOrder: "alphabetic", cernerConfig: { version: 1, sortAlphabetic: true } });
    expect(sorted).not.toHaveProperty("shuffleOptions");
    const shuffled = writeOptionDisplayOrder(sorted, "shuffled");
    expect(shuffled).toMatchObject({ optionDisplayOrder: "shuffled", shuffleOptions: true, cernerConfig: { sortAlphabetic: false } });
    expect(readOptionDisplayOrder(shuffled)).toBe("shuffled");
    const authored = optionDisplayOrderPatch(shuffled, "authored");
    expect(authored).toEqual({ optionDisplayOrder: undefined, shuffleOptions: false });
    expect(readOptionDisplayOrder({ ...shuffled, ...authored })).toBe("authored");
  });

  it("an alphabetic order on a field without Cerner settings stands alone", () => {
    const written = writeOptionDisplayOrder({ id: "a", type: "choice" }, "alphabetic");
    expect(written).toEqual({ id: "a", type: "choice", optionDisplayOrder: "alphabetic" });
    expect(readOptionDisplayOrder(written)).toBe("alphabetic");
  });

  it("sorts answers by label, keeping equal labels in authored order", () => {
    expect(optionsInDisplayOrder(["beta", { label: "Alpha", value: "a" }, "item 10", "item 2"], "alphabetic"))
      .toEqual([{ label: "Alpha", value: "a" }, "beta", "item 2", "item 10"]);
    expect(optionsInDisplayOrder(["b", "a"], "shuffled")).toEqual(["b", "a"]);
  });

  it("shuffles with the given random source", () => {
    expect(shuffleForDisplay([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffleForDisplay([1, 2, 3], () => 0.999)).toEqual([1, 2, 3]);
  });
});

describe("help position", () => {
  it.each(table(HELP_POSITION_CASES))("reads: %s", (_name, entry) => {
    expect(readHelpPosition(entry.field)).toBe(entry.expected);
  });

  it("mirrors into the Cerner placement only on a Cerner field", () => {
    expect(writeHelpPosition({ id: "a" }, "left_of_field")).toEqual({ id: "a", helpPosition: "left_of_field" });
    const cerner = writeHelpPosition({ id: "a", cernerConfig: { helpTextPosition: "source" } }, "right_of_input");
    expect(cerner).toEqual({ id: "a", helpPosition: "right_of_input", cernerConfig: { helpTextPosition: "right" } });
    expect(readHelpPosition(cerner)).toBe("right_of_input");
    expect(helpPositionPatch({ id: "a", helpPosition: "above_input" as const }, "above_input")).toEqual({});
  });
});

describe("label position", () => {
  it.each(table(LABEL_POSITION_CASES))("reads: %s", (_name, entry) => {
    expect(readLabelPosition(entry.field)).toBe(entry.expected);
  });

  it("writes labelPosition and removes the retired textarea spelling", () => {
    const field = { id: "a", type: "textarea", textareaConfig: { rows: 4, labelPosition: "top" as const } };
    expect(writeLabelPosition(field, "left")).toEqual({ id: "a", type: "textarea", labelPosition: "left", textareaConfig: { rows: 4 } });
    expect(labelPositionPatch(field, undefined)).toEqual({ textareaConfig: { rows: 4 } });
  });
});

describe("choice answer layout", () => {
  it.each(table(CHOICE_LAYOUT_CASES))("reads: %s", (_name, entry) => {
    expect(readChoiceLayout(entry.field)).toEqual(entry.expected);
  });

  it("writes the layout with the three legacy mirrors and keeps an exact MOIS size its density covers", () => {
    const field = { id: "a", type: "choice", moisOptionSize: "min" };
    const written = writeChoiceLayout(field, { arrangement: "columns-2", order: "column-first", density: "compact" });
    expect(written).toEqual({
      id: "a",
      type: "choice",
      choiceLayout: { arrangement: "columns-2", order: "column-first", density: "compact" },
      choiceAnswerLayout: "columns-2",
      choiceAnswerOrder: "column-first",
      moisOptionSize: "min",
    });
    expect(moisOptionSizeOf(written)).toBe("min");
    const roomy = writeChoiceLayout(written, { ...readChoiceLayout(written), density: "comfortable" });
    expect(roomy.moisOptionSize).toBe("large");
    const standard = choiceLayoutPatch(roomy, { arrangement: "columns-2", order: "column-first", density: "standard" });
    expect(standard).toEqual({ choiceLayout: { arrangement: "columns-2", order: "column-first", density: "standard" }, moisOptionSize: undefined });
    expect(moisOptionSizeOf({ ...roomy, ...standard })).toBeUndefined();
    expect(writeChoiceLayout({ id: "a", choiceAnswerLayout: "inline" }, {})).toEqual({ id: "a" });
  });

  it("a density alone gives MOIS its size", () => {
    expect(moisOptionSizeOf({ choiceLayout: { density: "spacious" } })).toBe("max");
    expect(moisOptionSizeOf({ moisOptionSize: "tiny", choiceLayout: { density: "compact" } })).toBe("tiny");
  });
});

describe("MOIS keyboard shortcuts", () => {
  it.each(table(MOIS_HOT_KEY_CASES))("reads: %s", (_name, entry) => {
    expect(readMoisHotKeys(entry.field)).toEqual(entry.expected);
  });

  it.each(table(MOIS_OPTION_HOT_KEY_CASES))("reads an answer's key: %s", (_name, entry) => {
    expect(readMoisOptionHotKey(entry.field)).toEqual(entry.expected);
  });

  it("writes moisConfig with the top-level mirror", () => {
    const on = writeMoisHotKeys({ id: "a", moisConfig: { localWrite: { targetId: "x" } } }, { autoHotKey: true });
    expect(on).toEqual({ id: "a", autoHotKey: true, moisConfig: { localWrite: { targetId: "x" }, autoHotKey: true } });
    expect(moisHotKeysPatch(on, { autoHotKey: false })).toEqual({ autoHotKey: false, moisConfig: { localWrite: { targetId: "x" } } });
    expect(writeMoisHotKeys({ id: "a", moisConfig: { autoHotKey: true } }, { autoHotKey: false })).toEqual({ id: "a", moisConfig: null });
  });

  it("writes an answer's key and order", () => {
    expect(writeMoisOptionHotKey("Yes", { hotKey: "y" })).toEqual({ label: "Yes", hotKey: "y", moisConfig: { hotKey: "y" } });
    expect(writeMoisOptionHotKey("Yes", {})).toBe("Yes");
    expect(writeMoisOptionHotKey({ label: "No", hotKey: "n", order: 1, moisConfig: { hotKey: "n", order: 1 } }, { order: 2 }))
      .toEqual({ label: "No", order: 2, moisConfig: { order: 2 } });
  });
});

describe("choice style names", () => {
  it("reads the MOIS names as their neutral names", () => {
    expect(normalizeChoiceStyle("simpleCodeSelect")).toBe("dropdown");
    expect(normalizeChoiceStyle("findCode")).toBe("searchable");
    expect(normalizeChoiceStyle("radio")).toBe("radio");
    expect(normalizeChoiceStyle("bogus")).toBeUndefined();
    expect(readChoiceStyle({})).toBe("searchable");
    expect(readChoiceStyle({}, "tableColumn")).toBe("dropdown");
    expect(readChoiceStyle({ choiceStyle: "findCode" }, "tableColumn")).toBe("searchable");
  });

  it("draws a searchable single choice the way findCode was drawn", () => {
    expect(choiceDisplayOf("searchable")).toEqual(choiceDisplayOf("findCode"));
    expect(choiceStyleFor({ presentation: "searchable", selection: "single" })).toBe("searchable");
  });
});

describe("exclusive answers", () => {
  const options = [{ label: "None", value: "none" }, { label: "Pain", value: "pain" }, { label: "Unable", value: "unable", exclusive: true }];

  it("reads the answers' flags", () => {
    expect(exclusiveAnswerValues(options)).toEqual(["unable"]);
    expect(exclusiveAnswerValues({ options })).toEqual(["unable"]);
  });

  it("reads Cerner's first-answer-exclusive option as the first answer's flag", () => {
    expect(exclusiveAnswerValues({ options, cernerConfig: { firstResponseExclusive: true } })).toEqual(["none", "unable"]);
    const flagged = [{ ...options[0], exclusive: true }, ...options.slice(1)];
    expect(exclusiveAnswerValues({ options: flagged, cernerConfig: { firstResponseExclusive: true } })).toEqual(["none", "unable"]);
    expect(exclusiveAnswerValues({ options: flagged, cernerConfig: { firstResponseExclusive: false } })).toEqual(["unable"]);
    expect(exclusiveAnswerValues({ options: flagged, cernerConfig: {} })).toEqual(["none", "unable"]);
    expect(exclusiveAnswerValues({ options: [], cernerConfig: { firstResponseExclusive: true } })).toEqual([]);
  });
});
