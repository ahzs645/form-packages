/**
 * Copy a component's non-React statics onto a wrapper, the way upstream's
 * `hoist-non-react-statics` does for `injectIntl`.
 *
 * Terra hangs real API off its components — `Select.Option`, `Select.OptGroup`,
 * `Hookshot.Content`, `Hookshot.Utils` — and both of our wrappers
 * (`withDefaults`, `injectIntl`) would otherwise drop them, breaking the
 * documented `<Select.Option />` usage.
 */
const REACT_STATICS = new Set([
  "childContextTypes",
  "contextType",
  "contextTypes",
  "defaultProps",
  "displayName",
  "getDefaultProps",
  "getDerivedStateFromError",
  "getDerivedStateFromProps",
  "mixins",
  "propTypes",
  "type",
  "arguments",
  "arity",
  "caller",
  "callee",
  "length",
  "name",
  "prototype",
]);

export function hoistStatics<T extends object>(target: T, source: object): T {
  for (const key of Object.getOwnPropertyNames(source)) {
    if (REACT_STATICS.has(key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor) continue;
    try {
      Object.defineProperty(target, key, descriptor);
    } catch {
      /* non-configurable on the wrapper; nothing we can do or need to do */
    }
  }
  return target;
}
