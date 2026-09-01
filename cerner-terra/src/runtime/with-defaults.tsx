import React from "react";

import { hoistStatics } from "./hoist-statics";

/**
 * React 19 removed `defaultProps` for function components. Terra sets
 * defaults with the uniform pattern
 *
 *   Component.defaultProps = defaultProps;
 *   export default Component;
 *
 * so the vendor script rewrites only that tail into
 *
 *   export default withDefaults(Component, defaultProps);
 *
 * keeping the component bodies byte-identical to upstream and the fork
 * cheap to re-sync. Semantics match React's: a prop explicitly passed as
 * `undefined` falls back to the default.
 */
export function withDefaults<P extends object>(
  Component: React.ComponentType<P>,
  defaults: Partial<P>,
): React.ComponentType<P> {
  const Wrapped = (props: P) => {
    const merged = { ...props } as Record<string, unknown>;
    for (const key of Object.keys(defaults)) {
      if (merged[key] === undefined) {
        merged[key] = (defaults as Record<string, unknown>)[key];
      }
    }
    return React.createElement(Component, merged as P);
  };
  Wrapped.displayName = `withDefaults(${Component.displayName || Component.name || "Component"})`;
  // Some Terra internals dispatch on `child.type.name` — TableUtils.addScope
  // compares it against "TableHeaderCell" to decide where `scope` goes — so the
  // wrapper has to carry the wrapped component's name, not "Wrapped".
  if (Component.name) {
    Object.defineProperty(Wrapped, "name", { value: Component.name, configurable: true });
  }
  // Terra hangs subcomponents off the default export (`Select.Option`).
  return hoistStatics(Wrapped, Component);
}
