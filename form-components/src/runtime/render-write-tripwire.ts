/**
 * Dev-mode tripwire for render-phase form-state writes.
 *
 * Eval'd NHForms components are the one population that historically calls
 * setFormData during render (safe — the provider defers every update — but it
 * causes avoidable state churn, and the pattern produced an update loop in
 * production once). The NHForms loader wraps each extracted component function
 * with wrapSandboxComponent, so a depth counter reliably marks "an eval'd
 * component's render body is executing right now"; setFormData consults it and
 * warns once per component. The generation-time static scan
 * (scripts/generate-nhforms-sources.js) catches direct render-body calls; this
 * catches the ones routed through helpers the scan can't see.
 *
 * Production builds do not wrap and do not warn.
 */

let sandboxRenderDepth = 0;
let activeComponentName: string | null = null;
const warnedComponents = new Set<string>();

export const isSandboxRenderActive = (): boolean => sandboxRenderDepth > 0;

export const wrapSandboxComponent = <T extends (...args: any[]) => any>(name: string, component: T): T => {
  const wrapped = function (this: any, ...args: any[]) {
    sandboxRenderDepth += 1;
    const previous = activeComponentName;
    activeComponentName = name;
    try {
      return component.apply(this, args);
    } finally {
      sandboxRenderDepth -= 1;
      activeComponentName = previous;
    }
  };
  // Preserve statics (propTypes, schema attachments, etc.) and identity hints
  Object.assign(wrapped, component);
  (wrapped as any).displayName = (component as any).displayName || name;
  try {
    Object.defineProperty(wrapped, 'name', { value: component.name || name, configurable: true });
  } catch {
    // non-configurable name — cosmetic only
  }
  return wrapped as unknown as T;
};

export const warnIfRenderPhaseWrite = (): void => {
  if (sandboxRenderDepth <= 0) return;
  const name = activeComponentName || '(unknown component)';
  if (warnedComponents.has(name)) return;
  warnedComponents.add(name);
  console.warn(
    `[form-state] setFormData called during render of NHForms component "${name}". ` +
    'The write is deferred and safe, but it causes extra state churn — move it to ' +
    'useOnLoad/useEffect or an event handler. See docs/nhforms-performance-architecture.md.'
  );
};
