import { createTheme, type Theme } from "@fluentui/react/lib/Theme";

/**
 * PowerChart-flavored Fluent theme: Millennium's flat blue chrome instead of
 * the MOIS orange ramp. This restyles our controls to sit comfortably inside
 * PowerChart; true Cerner-native widgets (Terra) would be a separate render
 * target, not a theme.
 */
export const cernerPlayerTheme: Theme = createTheme({
  defaultFontStyle: {
    fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
  },
  palette: {
    themePrimary: "#2a5785",
    themeLighterAlt: "#f3f7fa",
    themeLighter: "#d9e5f0",
    themeLight: "#bccfe3",
    themeTertiary: "#7fa3c6",
    themeSecondary: "#3f6c99",
    themeDarkAlt: "#264e77",
    themeDark: "#204264",
    themeDarker: "#18314a",
    neutralPrimary: "#1f2933",
    neutralSecondary: "#3e4c59",
    neutralLight: "#e4e9ee",
    neutralLighter: "#eef1f4",
    neutralLighterAlt: "#f6f8fa",
    neutralQuaternaryAlt: "#dde3e9",
    white: "#ffffff",
  },
});

export const CERNER_BANNER_BACKGROUND = "#2a5785";
export const CERNER_PAGE_BACKGROUND = "#e9edf1";
