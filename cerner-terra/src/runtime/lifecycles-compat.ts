/**
 * Stand-in for `react-lifecycles-compat`.
 *
 * The real package back-ports `getDerivedStateFromProps` and
 * `getSnapshotBeforeUpdate` onto React versions older than 16.3 by rewriting
 * the class's legacy lifecycle methods. Terra's select menus call it on every
 * `Menu` class. React 19 implements both natively, so the polyfill is a no-op
 * — and the real one would refuse the classes outright, since it throws when a
 * component defines `getDerivedStateFromProps` without the legacy methods it
 * expects to replace.
 */
export function polyfill<T>(Component: T): T {
  return Component;
}

const lifecyclesCompat = { polyfill };
export default lifecyclesCompat;
