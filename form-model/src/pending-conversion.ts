import type { BuilderField } from "./index";

/**
 * The placeholder an import before the PowerForm grid conversions left on a
 * grid (Discrete 14, Ultra 17 or Power 19): "how other targets draw it is not
 * decided yet". Every grid now converts, so a saved session's marker no longer
 * applies and every target ignores it.
 */
export function isObsoleteGridPlaceholder(field: BuilderField): boolean {
  return field.type === "table" && field.pendingConversion?.source === "cerner-powerform" && [14, 17, 19].includes(field.cernerConfig?.inputType ?? 0);
}

/**
 * The field's pending-conversion placeholder (see BuilderField.pendingConversion),
 * or undefined when it has none or only an obsolete marker.
 */
export function readPendingConversion(field: BuilderField): BuilderField["pendingConversion"] | undefined {
  if (!field.pendingConversion || isObsoleteGridPlaceholder(field)) return undefined;
  return field.pendingConversion;
}
