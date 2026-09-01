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
import ComboboxImpl from "./vendor/terra-form-select/Combobox";
import DatePickerImpl from "./vendor/terra-date-picker/DatePicker";
import DatePickerFieldImpl from "./vendor/terra-date-picker/DatePickerField";
import DemographicsBannerImpl from "./vendor/terra-demographics-banner/DemographicsBanner";
import DividerImpl from "./vendor/terra-divider/Divider";
import FieldImpl from "./vendor/terra-form-field/Field";
import FieldsetImpl from "./vendor/terra-form-fieldset/Fieldset";
import HeadingImpl from "./vendor/terra-heading/Heading";
import HyperlinkImpl from "./vendor/terra-hyperlink/Hyperlink";
import InputImpl from "./vendor/terra-form-input/Input";
import MultiSelectImpl from "./vendor/terra-form-select/MultiSelect";
import NativeSelectImpl from "./vendor/terra-form-select/native-select/NativeSelect";
import NativeSelectFieldImpl from "./vendor/terra-form-select/native-select/NativeSelectField";
import RadioImpl from "./vendor/terra-form-radio/Radio";
import SearchSelectImpl from "./vendor/terra-form-select/SearchSelect";
import SelectImpl from "./vendor/terra-form-select/Select";
import SelectFieldImpl from "./vendor/terra-form-select/SelectField";
import SelectOptGroupImpl from "./vendor/terra-form-select/shared/_OptGroup";
import SelectOptionImpl from "./vendor/terra-form-select/shared/_Option";
import SingleSelectImpl from "./vendor/terra-form-select/SingleSelect";
import TableImpl, {
  Body as TableBodyImpl,
  Cell as TableCellImpl,
  Header as TableHeaderImpl,
  HeaderCell as TableHeaderCellImpl,
  Row as TableRowImpl,
} from "./vendor/terra-html-table";
import TextareaImpl from "./vendor/terra-form-textarea/Textarea";
import VisuallyHiddenTextImpl from "./vendor/terra-visually-hidden-text/VisuallyHiddenText";

import type {
  AlertProps,
  ButtonProps,
  CheckboxProps,
  DatePickerFieldProps,
  DatePickerProps,
  DemographicsBannerProps,
  DividerProps,
  FieldProps,
  FieldsetProps,
  HeadingProps,
  HyperlinkProps,
  InputProps,
  NativeSelectFieldProps,
  NativeSelectProps,
  RadioProps,
  SelectFieldProps,
  SelectOptGroupProps,
  SelectOptionProps,
  SelectProps,
  TableCellProps,
  TableHeaderCellProps,
  TableProps,
  TableRowProps,
  TableSectionProps,
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

/**
 * terra-form-select. `Select` dispatches on `variant`; the variants are also
 * reachable directly. `NativeSelect` is the plain `<select>` rendering — no
 * portal, no typeahead — and is the right choice inside a PowerChart MPage
 * where an overlay would clip.
 */
export const Select = SelectImpl as unknown as React.ComponentType<SelectProps>;
export const SelectField = SelectFieldImpl as unknown as React.ComponentType<SelectFieldProps>;
export const SingleSelect = SingleSelectImpl as unknown as React.ComponentType<SelectProps>;
export const SearchSelect = SearchSelectImpl as unknown as React.ComponentType<SelectProps>;
export const Combobox = ComboboxImpl as unknown as React.ComponentType<SelectProps>;
export const MultiSelect = MultiSelectImpl as unknown as React.ComponentType<SelectProps>;
export const SelectOption = SelectOptionImpl as unknown as React.ComponentType<SelectOptionProps>;
export const SelectOptGroup =
  SelectOptGroupImpl as unknown as React.ComponentType<SelectOptGroupProps>;
export const NativeSelect = NativeSelectImpl as unknown as React.ComponentType<NativeSelectProps>;
export const NativeSelectField =
  NativeSelectFieldImpl as unknown as React.ComponentType<NativeSelectFieldProps>;

/**
 * terra-html-table. A semantic `<table>` with Terra's zebra striping and
 * divider styles — not a data grid. Compose as
 * `Table > TableHeader > TableRow > TableHeaderCell` and
 * `Table > TableBody > TableRow > TableCell`.
 */
export const Table = TableImpl as unknown as React.ComponentType<TableProps>;
export const TableHeader = TableHeaderImpl as unknown as React.ComponentType<TableSectionProps>;
export const TableHeaderCell =
  TableHeaderCellImpl as unknown as React.ComponentType<TableHeaderCellProps>;
export const TableBody = TableBodyImpl as unknown as React.ComponentType<TableSectionProps>;
export const TableRow = TableRowImpl as unknown as React.ComponentType<TableRowProps>;
export const TableCell = TableCellImpl as unknown as React.ComponentType<TableCellProps>;

/** terra-date-picker. Values are ISO `YYYY-MM-DD` strings, not Date objects. */
export const DatePicker = DatePickerImpl as unknown as React.ComponentType<DatePickerProps>;
export const DatePickerField =
  DatePickerFieldImpl as unknown as React.ComponentType<DatePickerFieldProps>;

export * from "./types";
export { TerraIntlProvider, type TerraIntl } from "./runtime/intl";
export { default as ThemeContext, type TerraTheme } from "./runtime/theme-context";
export { withDefaults } from "./runtime/with-defaults";
