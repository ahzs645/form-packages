import React from "react";

/**
 * Stand-in for `terra-theme-context` (itself pinned to React 16). Terra
 * components only read `{ className }` from it to append a theme class, so
 * an empty default context reproduces the default theme exactly.
 */
export interface TerraTheme {
  className?: string;
}

const ThemeContext = React.createContext<TerraTheme>({});
export default ThemeContext;
