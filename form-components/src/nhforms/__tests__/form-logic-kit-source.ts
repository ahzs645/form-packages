/**
 * The generated FormLogicKit for tests that run NHForms source outside the
 * MOIS loader. Components that depend on the kit (ConditionalGroup and the
 * code the MOIS exporter emits) reference it as a bare identifier, so a
 * harness prepends this source, or passes `loadFormLogicKit()` in scope.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const FORM_LOGIC_KIT_SOURCE = fs.readFileSync(path.join(NH, "FormLogicKit", "index.jsx"), "utf8");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadFormLogicKit(): any {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`${FORM_LOGIC_KIT_SOURCE};\nreturn FormLogicKit;`)();
}
