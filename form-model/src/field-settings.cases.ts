/**
 * Case tables for the neutral field-settings readers (field-settings.ts):
 * every stored spelling of each setting and what it reads as.
 */
import type { BuilderChoiceLayout, MoisHotKeys, MoisOptionHotKey, NumberFormatReading, OptionDisplayOrder, FieldLabelPosition } from "./field-settings";
import type { HelpPosition } from "./index";

export interface ReadCase<T> {
  name: string;
  field: unknown;
  expected: T;
}

export const NUMBER_FORMAT_CASES: ReadCase<NumberFormatReading>[] = [
  { name: "nothing set", field: { id: "a", type: "number" }, expected: {} },
  { name: "neutral decimals on a number", field: { id: "a", type: "number", numberConfig: { typeNumber: "decimal", decimalPlaces: 2 } }, expected: { decimalPlaces: 2, source: "numberConfig" } },
  { name: "zero decimals are a setting", field: { id: "a", type: "number", numberConfig: { typeNumber: "number", decimalPlaces: 0 } }, expected: { decimalPlaces: 0, source: "numberConfig" } },
  { name: "a fractional value rounds", field: { id: "a", type: "number", numberConfig: { typeNumber: "decimal", decimalPlaces: 1.6 } }, expected: { decimalPlaces: 2, source: "numberConfig" } },
  { name: "negative and NaN are unusable", field: { id: "a", type: "number", numberConfig: { typeNumber: "decimal", decimalPlaces: -1 } }, expected: {} },
  { name: "more than 12 is capped", field: { id: "a", type: "number", numberConfig: { typeNumber: "decimal", decimalPlaces: 20 } }, expected: { decimalPlaces: 12, source: "numberConfig" } },
  {
    name: "a Cerner DTA's numeric map",
    field: { id: "a", type: "number", cernerConfig: { dta: { mnemonic: "Temp", definition: { numericMap: { minDigits: 1, maxDigits: 4, decimalPlaces: 1 } } } } },
    expected: { decimalPlaces: 1, source: "cernerNumericMap" },
  },
  {
    name: "an all-zero numeric map is unset",
    field: { id: "a", type: "number", cernerConfig: { dta: { mnemonic: "Bone age", definition: { numericMap: { minDigits: 0, maxDigits: 0, decimalPlaces: 0 } } } } },
    expected: {},
  },
  {
    name: "the neutral key wins over the DTA",
    field: { id: "a", type: "number", numberConfig: { typeNumber: "decimal", decimalPlaces: 2 }, cernerConfig: { dta: { mnemonic: "Temp", definition: { numericMap: { minDigits: 1, maxDigits: 4, decimalPlaces: 1 } } } } },
    expected: { decimalPlaces: 2, source: "numberConfig" },
  },
  { name: "computed precision", field: { id: "c", type: "computed", computedConfig: { expression: "a+b", precision: 1 } }, expected: { decimalPlaces: 1, source: "precision" } },
  {
    name: "calculatedValue's precision wins over computedConfig's",
    field: { id: "c", type: "computed", computedConfig: { expression: "a+b", precision: 1 }, calculatedValue: { id: "c", label: "C", expression: "a+b", precision: 3 } },
    expected: { decimalPlaces: 3, source: "precision" },
  },
  {
    name: "an unusable calculatedValue precision falls through",
    field: { id: "c", type: "computed", computedConfig: { expression: "a+b", precision: 1 }, calculatedValue: { id: "c", label: "C", expression: "a+b", precision: -2 } },
    expected: { decimalPlaces: 1, source: "precision" },
  },
  {
    name: "an AlayaCare score's decimals when the formula sets none",
    field: { id: "c", type: "computed", computedConfig: { expression: "a+b" }, alayaCareConfig: { fieldType: "score", scoreDecimals: 2 } },
    expected: { decimalPlaces: 2, source: "alayaCareScore" },
  },
  {
    name: "precision wins over an AlayaCare score's decimals",
    field: { id: "c", type: "computed", computedConfig: { expression: "a+b", precision: 0 }, alayaCareConfig: { fieldType: "score", scoreDecimals: 2 } },
    expected: { decimalPlaces: 0, source: "precision" },
  },
  { name: "a computed layout-like object without a type", field: { computedConfig: { expression: "x", precision: 2 } }, expected: { decimalPlaces: 2, source: "precision" } },
];

export const OPTION_DISPLAY_ORDER_CASES: ReadCase<OptionDisplayOrder>[] = [
  { name: "nothing set", field: { id: "a", type: "choice" }, expected: "authored" },
  { name: "neutral alphabetic", field: { id: "a", type: "choice", optionDisplayOrder: "alphabetic" }, expected: "alphabetic" },
  { name: "neutral shuffled", field: { id: "a", type: "choice", optionDisplayOrder: "shuffled", shuffleOptions: true }, expected: "shuffled" },
  { name: "legacy shuffleOptions", field: { id: "a", type: "choice", shuffleOptions: true }, expected: "shuffled" },
  { name: "shuffleOptions false", field: { id: "a", type: "choice", shuffleOptions: false }, expected: "authored" },
  { name: "Cerner sortAlphabetic", field: { id: "a", type: "choice", cernerConfig: { sortAlphabetic: true } }, expected: "alphabetic" },
  {
    name: "a stored order that its mirror agrees with",
    field: { id: "a", type: "choice", optionDisplayOrder: "alphabetic", cernerConfig: { sortAlphabetic: true } },
    expected: "alphabetic",
  },
  {
    name: "an older editor cleared the Cerner mirror",
    field: { id: "a", type: "choice", optionDisplayOrder: "alphabetic", cernerConfig: { sortAlphabetic: false } },
    expected: "authored",
  },
  {
    name: "an older editor turned shuffling off",
    field: { id: "a", type: "choice", optionDisplayOrder: "shuffled", shuffleOptions: false },
    expected: "authored",
  },
  { name: "an unknown stored order reads the legacy keys", field: { id: "a", type: "choice", optionDisplayOrder: "random", shuffleOptions: true }, expected: "shuffled" },
];

export const HELP_POSITION_CASES: ReadCase<HelpPosition>[] = [
  { name: "default below", field: { id: "a", helpText: "x" }, expected: "below_input" },
  { name: "above", field: { id: "a", helpPosition: "above_input" }, expected: "above_input" },
  { name: "neutral side positions", field: { id: "a", helpPosition: "right_of_input" }, expected: "right_of_input" },
  { name: "Cerner placement alone", field: { id: "a", cernerConfig: { helpTextPosition: "left" } }, expected: "left_of_field" },
  { name: "Cerner placement that agrees", field: { id: "a", helpPosition: "above_input", cernerConfig: { helpTextPosition: "above" } }, expected: "above_input" },
  { name: "Cerner placement edited later wins", field: { id: "a", helpPosition: "above_input", cernerConfig: { helpTextPosition: "right" } }, expected: "right_of_input" },
  { name: "Cerner source keeps the neutral key", field: { id: "a", helpPosition: "above_input", cernerConfig: { helpTextPosition: "source" } }, expected: "above_input" },
  { name: "an unknown value is below", field: { id: "a", helpPosition: "beside" }, expected: "below_input" },
];

export const LABEL_POSITION_CASES: ReadCase<FieldLabelPosition | undefined>[] = [
  { name: "follows the form", field: { id: "a", type: "text" }, expected: undefined },
  { name: "own position", field: { id: "a", type: "text", labelPosition: "left" }, expected: "left" },
  { name: "retired textarea spelling", field: { id: "a", type: "textarea", textareaConfig: { rows: 4, labelPosition: "none" } }, expected: "none" },
  { name: "the textarea spelling wins while stored (as the MOIS export read it)", field: { id: "a", type: "textarea", labelPosition: "left", textareaConfig: { rows: 4, labelPosition: "top" } }, expected: "top" },
  { name: "an unknown value follows the form", field: { id: "a", labelPosition: "right" }, expected: undefined },
];

export const CHOICE_LAYOUT_CASES: ReadCase<BuilderChoiceLayout>[] = [
  { name: "nothing set", field: { id: "a", type: "choice" }, expected: {} },
  { name: "legacy arrangement and order", field: { choiceAnswerLayout: "columns-3", choiceAnswerOrder: "column-first" }, expected: { arrangement: "columns-3", order: "column-first" } },
  { name: "legacy MOIS size small is compact", field: { choiceAnswerLayout: "inline", moisOptionSize: "small" }, expected: { arrangement: "inline", density: "compact" } },
  { name: "MOIS min and tiny are compact too", field: { moisOptionSize: "min" }, expected: { density: "compact" } },
  { name: "MOIS medium is standard", field: { moisOptionSize: "medium" }, expected: { density: "standard" } },
  { name: "MOIS large is comfortable", field: { moisOptionSize: "large" }, expected: { density: "comfortable" } },
  { name: "an unknown MOIS size has no density", field: { moisOptionSize: "huge" }, expected: {} },
  { name: "neutral layout alone", field: { choiceLayout: { arrangement: "vertical", density: "spacious" } }, expected: { arrangement: "vertical", density: "spacious" } },
  {
    name: "neutral layout with agreeing mirrors",
    field: { choiceLayout: { arrangement: "columns-2", order: "row-first", density: "compact" }, choiceAnswerLayout: "columns-2", choiceAnswerOrder: "row-first", moisOptionSize: "tiny" },
    expected: { arrangement: "columns-2", order: "row-first", density: "compact" },
  },
  {
    name: "an older editor changed the arrangement",
    field: { choiceLayout: { arrangement: "columns-2", density: "comfortable" }, choiceAnswerLayout: "inline", moisOptionSize: "large" },
    expected: { arrangement: "inline", density: "comfortable" },
  },
  {
    name: "an older editor changed the MOIS size",
    field: { choiceLayout: { density: "comfortable" }, moisOptionSize: "small" },
    expected: { density: "compact" },
  },
];

export const MOIS_HOT_KEY_CASES: ReadCase<MoisHotKeys>[] = [
  { name: "off by default", field: { id: "a", type: "choice" }, expected: { autoHotKey: false } },
  { name: "legacy top level", field: { id: "a", autoHotKey: true }, expected: { autoHotKey: true } },
  { name: "moisConfig", field: { id: "a", moisConfig: { autoHotKey: true } }, expected: { autoHotKey: true } },
  { name: "an older editor turned the top-level key off", field: { id: "a", autoHotKey: false, moisConfig: { autoHotKey: true } }, expected: { autoHotKey: false } },
];

export const MOIS_OPTION_HOT_KEY_CASES: ReadCase<MoisOptionHotKey>[] = [
  { name: "a string answer", field: "Yes", expected: {} },
  { name: "legacy keys", field: { label: "Yes", hotKey: "Yes", order: 2 }, expected: { hotKey: "Y", order: 2 } },
  { name: "moisConfig", field: { label: "No", moisConfig: { hotKey: "n", order: 1 } }, expected: { hotKey: "n", order: 1 } },
  { name: "legacy keys win when present", field: { label: "No", hotKey: "x", moisConfig: { hotKey: "n", order: 1 } }, expected: { hotKey: "x", order: 1 } },
  { name: "a blank key and a non-number order are unset", field: { label: "No", hotKey: " ", order: "3" }, expected: {} },
];
