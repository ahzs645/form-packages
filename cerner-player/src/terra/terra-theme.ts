import { createTheme, type Theme } from "@fluentui/react/lib/Theme";

/**
 * Fluent theme carrying Terra's palette and typography, so the MOIS form
 * runtime's controls render in Cerner's design language inside PowerChart.
 * Values are Terra Core defaults (Apache-2.0): emphasis #0079be with
 * #01639e border, active #004c76, neutral #dedfe0/#c8cacb, text #1c1f21,
 * error #e50000, chrome #f9f9f9, and Terra's 14px Helvetica Neue base.
 */
export const terraFluentTheme: Theme = createTheme({
  defaultFontStyle: {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSize: 14,
  },
  palette: {
    themePrimary: "#0079be",
    themeSecondary: "#1a88c8",
    themeDarkAlt: "#01639e",
    themeDark: "#004c76",
    themeDarker: "#003a5c",
    themeTertiary: "#66aed8",
    themeLight: "#cce4f2",
    themeLighter: "#e6f2f8",
    themeLighterAlt: "#f5fafd",
    neutralPrimary: "#1c1f21",
    neutralSecondary: "#4e5558",
    neutralTertiary: "#6f7477",
    neutralQuaternary: "#c8cacb",
    neutralQuaternaryAlt: "#dedfe0",
    neutralLight: "#dedfe0",
    neutralLighter: "#f4f4f4",
    neutralLighterAlt: "#f9f9f9",
    redDark: "#c00000",
    red: "#e50000",
    white: "#ffffff",
  },
});

/** Page background behind the form when rendering in Cerner mode. */
export const TERRA_PAGE_BACKGROUND = "#f4f4f4";
