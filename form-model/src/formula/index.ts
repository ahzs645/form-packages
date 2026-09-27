/**
 * EMR-neutral formulas: the stored tree, its parser and printer, the function
 * registry with per-target support, static types, and the reference
 * evaluator. Semantics: docs/.../architecture/formula-semantics.md.
 */

export {
  FORMULA_ARITHMETIC_OPS,
  FORMULA_COMPARISON_OPS,
  FORMULA_LOGICAL_OPS,
  FORMULA_VALUE_TYPES,
  bindFormulaParams,
  formulaChildren,
  formulaExpr,
  formulaFunctions,
  formulaParams,
  formulaReferences,
  inlineScoreMaps,
  isStoredFormula,
  mapFormula,
  renameFormulaReferences,
  walkFormula,
  type FormulaArithmeticOp,
  type FormulaBinaryOp,
  type FormulaComparisonOp,
  type FormulaDiagnostic,
  type FormulaLogicalOp,
  type FormulaMapEntry,
  type FormulaNode,
  type FormulaNodeKind,
  type FormulaUnaryOp,
  type FormulaValueType,
  type StoredFormula,
} from "./ast";
export {
  FORMULA_DURATION_UNITS,
  FORMULA_FUNCTIONS,
  FORMULA_OPERATORS,
  FORMULA_TARGETS,
  findFormulaFunction,
  formulaArityError,
  type FormulaEngine,
  type FormulaFunctionCategory,
  type FormulaFunctionParam,
  type FormulaFunctionSpec,
  type FormulaOperatorSpec,
  type FormulaParamType,
  type FormulaTarget,
  type FormulaTargetSupport,
} from "./registry";
export {
  FORMULA_PARAM_CHAR,
  FORMULA_REF_CHAR,
  parseFormula,
  parseFormulaOrThrow,
  type FormulaDialect,
  type ParseFormulaOptions,
  type ParseFormulaResult,
} from "./parse";
export { printFormula } from "./print";
export { checkFormula, formulaValueTypeForFieldType, inferFormulaType, isTimeReference, type FormulaTypeEnv } from "./types";
export {
  evaluateFormula,
  formulaAnswerNumber,
  formulaAnswerOutput,
  formulaAnswerText,
  formulaEnvFromValues,
  isBlankFormulaAnswer,
  roundFormulaNumber,
  type FormulaEnv,
  type FormulaIncompleteMode,
} from "./evaluate";
export {
  readFormulaStore,
  writeFormulaStore,
  type FormulaStoreReading,
  type FormulaStoreText,
  type FormulaStoreWrite,
} from "./store";
/** The NHForms FormulaKit API (generated into the MOIS runtime by scripts/generate-formula-kit.mjs). */
export * as formulaKit from "./kit";
export type { FormulaKitOptions, FormulaKitParseResult, FormulaKitValues } from "./kit";
