/**
 * Fluent theme for MOIS form previews.
 *
 * The MOIS FormTester loads a custom Fluent theme (orange #f3911f primary
 * ramp, verbatim in src/data/theme-object.json, extracted from the SMOIS
 * bundle). Our MoisContext useTheme() serves that JSON to our own controls,
 * but stock Fluent components (PrimaryButton, Dialog, Dropdown chrome) read
 * the Fluent theme context — so previews must mount this theme via
 * <ThemeProvider> or those controls render default Fluent blue.
 *
 * ThemeProvider context flows through Layer portals, so portaled Dialogs
 * (SubForm modals) pick it up as long as the provider wraps the React tree.
 */

import { createTheme, Theme } from '@fluentui/react';
import themeObject from './data/theme-object.json';

export const moisPreviewTheme: Theme = createTheme({
  palette: themeObject.palette as never,
  semanticColors: themeObject.semanticColors as never,
  effects: themeObject.effects as never,
  isInverted: themeObject.isInverted,
});
