/**
 * Source of the NHForms FormLogicKit: the form-logic runtime of
 * @webforms/form-model (runtime-logic.ts) plus the two DOM helpers the
 * error summary uses. scripts/generate-form-logic-kit.mjs bundles this file
 * into nhforms/FormLogicKit/index.jsx; edit here or in form-model, never the
 * generated file.
 */

export * from "../../../form-model/src/runtime-logic";

const toText = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

const FOCUSABLE = "input, textarea, select, button, [tabindex]";
// Enabled controls only: a disabled or read-only display cell (a
// repeat-for-each label column) cannot take focus.
const CONTROL =
  'input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [role=combobox]:not([aria-disabled=true]), [tabindex]:not([tabindex="-1"])';

const escapeAttr = (value: unknown): string =>
  typeof CSS !== "undefined" && CSS && typeof CSS.escape === "function" ? CSS.escape(toText(value)) : toText(value).replace(/["\\]/g, "\\$&");

// A field label as rendered, without the required marker.
const labelText = (element: Element | null) => toText(element && element.textContent).replace(/\s*\*\s*$/, "").trim();

/**
 * The element that stands for a field on screen: { control, wrapper }.
 * Preview controls carry id=fieldId / [data-field-id]; the real MOIS runtime
 * does not (its TextField inputs get generated ids, OptionChoice radios get
 * name=fieldId, and a LayoutItem renders <div><label>Label</label>…</div>).
 * So after the id lookups this falls back to radios by name, repeat-for-each
 * tables by their wrapper, and the control beside a <label> with the field's
 * label text. `label` is optional.
 */
export function locateField(fieldId: unknown, label?: unknown): { control: Element | null; wrapper: Element } | null {
  if (typeof document === "undefined" || !fieldId) return null;
  const byId = document.getElementById(toText(fieldId));
  if (byId && byId.matches && byId.matches(FOCUSABLE)) return { control: byId, wrapper: byId };
  const escaped = escapeAttr(fieldId);
  const wrapper = byId || document.querySelector(`[data-field-id="${escaped}"]`) || document.querySelector(`[data-repeat-for-table="${escaped}"]`);
  if (wrapper) return { control: wrapper.querySelector ? wrapper.querySelector(CONTROL) : null, wrapper };
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${escaped}"]:not([disabled])`));
  if (radios.length > 0) {
    const checked = radios.find((radio) => radio.checked);
    return { control: checked || radios[0], wrapper: radios[0].parentElement || radios[0] };
  }
  const wanted = toText(label).replace(/\s*\*\s*$/, "").trim();
  if (!wanted) return null;
  const labels = Array.from(document.querySelectorAll("label")).filter((element) => labelText(element) === wanted);
  for (const element of labels) {
    const container = element.parentElement;
    const control = container && container.querySelector ? container.querySelector(CONTROL) : null;
    if (control && container) return { control, wrapper: container };
  }
  return null;
}

/** Move focus to a field (see locateField), else scroll its wrapper into view. True when something was focused or scrolled to. */
export function focusField(fieldId: unknown, label?: unknown): boolean {
  const found = locateField(fieldId, label);
  if (!found) return false;
  const { control, wrapper } = found;
  const focusable = control as HTMLElement | null;
  if (focusable && typeof focusable.focus === "function") {
    if (typeof focusable.scrollIntoView === "function") focusable.scrollIntoView({ block: "center" });
    focusable.focus();
    return true;
  }
  if (wrapper && typeof (wrapper as HTMLElement).scrollIntoView === "function") {
    (wrapper as HTMLElement).scrollIntoView({ block: "center" });
    return true;
  }
  return false;
}
