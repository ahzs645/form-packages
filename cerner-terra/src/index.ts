/**
 * Cerner Terra components, vendored for React 19.
 *
 * Terra Core is Apache-2.0 but was archived in 2024 with peer dependencies
 * pinned to React 16, so it cannot be consumed from npm here. See
 * scripts/vendor.mjs for the (mechanical, re-runnable) adaptation and NOTICE
 * for attribution.
 *
 * The vendored sources are plain JSX with PropTypes; the casts below attach
 * the hand-written prop types from ./types so consumers get real checking.
 * They route through `unknown` because TypeScript infers the untyped JSX
 * (e.g. Terra defaults `name` to null where our type says `string`).
 */
import type * as React from "react";

import AlertImpl from "./vendor/terra-alert/Alert";
import ButtonImpl from "./vendor/terra-button/Button";
import CheckboxImpl from "./vendor/terra-form-checkbox/Checkbox";
import DemographicsBannerImpl from "./vendor/terra-demographics-banner/DemographicsBanner";
import DividerImpl from "./vendor/terra-divider/Divider";
import FieldImpl from "./vendor/terra-form-field/Field";
import FieldsetImpl from "./vendor/terra-form-fieldset/Fieldset";
import HeadingImpl from "./vendor/terra-heading/Heading";
import HyperlinkImpl from "./vendor/terra-hyperlink/Hyperlink";
import InputImpl from "./vendor/terra-form-input/Input";
import RadioImpl from "./vendor/terra-form-radio/Radio";
import TextareaImpl from "./vendor/terra-form-textarea/Textarea";
import VisuallyHiddenTextImpl from "./vendor/terra-visually-hidden-text/VisuallyHiddenText";

import type {
  AlertProps,
  ButtonProps,
  CheckboxProps,
  DemographicsBannerProps,
  DividerProps,
  FieldProps,
  FieldsetProps,
  HeadingProps,
  HyperlinkProps,
  InputProps,
  RadioProps,
  TextareaProps,
  VisuallyHiddenTextProps,
} from "./types";

export const Alert = AlertImpl as unknown as React.ComponentType<AlertProps>;
export const Button = ButtonImpl as unknown as React.ComponentType<ButtonProps>;
export const Checkbox = CheckboxImpl as unknown as React.ComponentType<CheckboxProps>;
export const DemographicsBanner =
  DemographicsBannerImpl as unknown as React.ComponentType<DemographicsBannerProps>;
export const Divider = DividerImpl as unknown as React.ComponentType<DividerProps>;
export const Field = FieldImpl as unknown as React.ComponentType<FieldProps>;
export const Fieldset = FieldsetImpl as unknown as React.ComponentType<FieldsetProps>;
export const Heading = HeadingImpl as unknown as React.ComponentType<HeadingProps>;
export const Hyperlink = HyperlinkImpl as unknown as React.ComponentType<HyperlinkProps>;
export const Input = InputImpl as unknown as React.ComponentType<InputProps>;
export const Radio = RadioImpl as unknown as React.ComponentType<RadioProps>;
export const Textarea = TextareaImpl as unknown as React.ComponentType<TextareaProps>;
export const VisuallyHiddenText =
  VisuallyHiddenTextImpl as unknown as React.ComponentType<VisuallyHiddenTextProps>;

export * from "./types";
export { TerraIntlProvider, type TerraIntl } from "./runtime/intl";
export { default as ThemeContext, type TerraTheme } from "./runtime/theme-context";
export { withDefaults } from "./runtime/with-defaults";
