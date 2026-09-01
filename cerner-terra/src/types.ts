import type * as React from "react";

/**
 * Prop types for the vendored Terra components. Terra is PropTypes-based and
 * ships no TypeScript types, so these are hand-written from each component's
 * upstream propTypes block and applied at the barrel in index.ts.
 */

type Div = React.HTMLAttributes<HTMLDivElement>;

export type ButtonVariant =
  | "neutral"
  | "emphasis"
  | "ghost"
  | "de-emphasis"
  | "action"
  | "utility";

export interface ButtonProps
  extends Omit<Div, "onClick" | "onBlur" | "onFocus" | "title"> {
  text: string;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  icon?: React.ReactNode;
  isBlock?: boolean;
  isCompact?: boolean;
  isDisabled?: boolean;
  isIconOnly?: boolean;
  isReversed?: boolean;
  href?: string;
  onClick?: React.MouseEventHandler;
  title?: string;
}

export interface FieldProps {
  children?: React.ReactNode;
  label?: React.ReactNode;
  labelAttrs?: object;
  error?: React.ReactNode;
  help?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hideRequired?: boolean;
  showOptional?: boolean;
  isInvalid?: boolean;
  isInline?: boolean;
  isLabelHidden?: boolean;
  maxWidth?: string;
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  isIncomplete?: boolean;
  isInvalid?: boolean;
  refCallback?: (node: HTMLInputElement | null) => void;
}

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  isIncomplete?: boolean;
  isInvalid?: boolean;
  size?: "small" | "medium" | "large" | "full";
  refCallback?: (node: HTMLTextAreaElement | null) => void;
}

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  labelText?: React.ReactNode;
  isLabelHidden?: boolean;
  isInline?: boolean;
  inputAttrs?: object;
}

export type RadioProps = CheckboxProps;

export interface FieldsetProps extends Div {
  legend?: string;
  legendAttrs?: object;
  required?: boolean;
  hideRequired?: boolean;
  isInvalid?: boolean;
  error?: React.ReactNode;
  help?: React.ReactNode;
}

export interface DemographicsBannerProps {
  personName?: string;
  preferredFirstName?: string;
  age?: string;
  dateOfBirth?: string;
  dateOfBirthLabel?: string;
  deceasedDate?: string;
  gender?: string;
  gestationalAge?: string;
  identifiers?: Record<string, string>;
  photo?: React.ReactNode;
  applicationContent?: React.ReactNode;
  personNameHeadingLevel?: number;
}

export interface AlertProps {
  children?: React.ReactNode;
  type?: "alert" | "error" | "warning" | "advisory" | "info" | "success" | "custom";
  title?: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
}

export interface HeadingProps extends Div {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: "mini" | "tiny" | "small" | "medium" | "large" | "huge";
  weight?: 200 | 400 | 700;
  color?: "default" | "attention" | "info" | "success";
  isVisuallyHidden?: boolean;
}

export interface DividerProps extends Div {
  text?: string;
}

export interface HyperlinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: "default" | "audio" | "document" | "external" | "image" | "video";
  isUnderlineHidden?: boolean;
}

export interface VisuallyHiddenTextProps {
  text?: string;
}

/* -------------------------------------------------------------------------
 * terra-form-select
 * ---------------------------------------------------------------------- */

export type SelectValue = string | number;

export type SelectVariant = "default" | "combobox" | "multiple" | "search" | "tag";

/** `<Select.Option />` / the standalone `SelectOption` export. */
export interface SelectOptionProps {
  value: SelectValue;
  display?: string;
  disabled?: boolean;
}

/** `<Select.OptGroup />` / the standalone `SelectOptGroup` export. */
export interface SelectOptGroupProps {
  label: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Common surface of the Frame-based (non-native) selects. `Select` dispatches
 * on `variant`; `SingleSelect` / `SearchSelect` / `Combobox` / `MultiSelect` /
 * `TagSelect` are the same components reached directly.
 */
export interface SelectProps {
  children?: React.ReactNode;
  value?: SelectValue | SelectValue[];
  defaultValue?: SelectValue | SelectValue[];
  placeholder?: string;
  variant?: SelectVariant;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  isIncomplete?: boolean;
  isInvalid?: boolean;
  /** Render the dropdown inline rather than through a portal (touch a11y). */
  isTouchAccessible?: boolean;
  maxHeight?: number;
  /** Only meaningful for the `multiple` and `tag` variants. */
  maxSelectionCount?: number;
  noResultContent?: React.ReactNode;
  dropdownAttrs?: object;
  onChange?: (value: SelectValue | SelectValue[] | null) => void;
  onSelect?: (value: SelectValue, option?: React.ReactElement) => void;
  onDeselect?: (value: SelectValue) => void;
  onSearch?: (searchValue: string) => void;
  optionFilter?: (searchValue: string, option: React.ReactElement) => boolean;
  onBlur?: React.FocusEventHandler;
  onFocus?: React.FocusEventHandler;
  onClick?: React.MouseEventHandler;
  /** SearchSelect / Combobox only. */
  inputId?: string;
}

/**
 * Props a Terra `*Field` wrapper adds on top of the control it composes with a
 * `Field` (label, help/error text, required affordances).
 */
export interface TerraFieldWrapperProps {
  label: React.ReactNode;
  labelAttrs?: object;
  error?: React.ReactNode;
  help?: React.ReactNode;
  hideRequired?: boolean;
  showOptional?: boolean;
  isInline?: boolean;
  isLabelHidden?: boolean;
  maxWidth?: string;
}

export interface SelectFieldProps
  extends Pick<
      SelectProps,
      | "children"
      | "value"
      | "defaultValue"
      | "placeholder"
      | "variant"
      | "disabled"
      | "required"
      | "allowClear"
      | "isIncomplete"
      | "isInvalid"
      | "isTouchAccessible"
      | "maxHeight"
      | "maxSelectionCount"
      | "onChange"
    >,
    TerraFieldWrapperProps {
  /** Required: wires the label's `htmlFor` to the rendered select. */
  selectId: string;
  selectAttrs?: object;
}

/** An `<option>` in the native `<select>` variant. */
export interface NativeSelectOption {
  value: SelectValue;
  display: string;
  disabled?: boolean;
}

/** An `<optgroup>` in the native `<select>` variant. */
export interface NativeSelectOptGroup {
  display: string;
  options: NativeSelectOption[];
  disabled?: boolean;
}

export interface NativeSelectProps {
  ariaLabel: string;
  ariaDescribedBy?: string;
  options?: (NativeSelectOption | NativeSelectOptGroup)[];
  value?: SelectValue;
  defaultValue?: SelectValue;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  isIncomplete?: boolean;
  isInvalid?: boolean;
  /** Compact styling for use in a filter bar. */
  isFilterStyle?: boolean;
  attrs?: object;
  refCallback?: (node: HTMLSelectElement | null) => void;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onBlur?: React.FocusEventHandler<HTMLSelectElement>;
  onFocus?: React.FocusEventHandler<HTMLSelectElement>;
  onMouseDown?: React.MouseEventHandler<HTMLSelectElement>;
}

export interface NativeSelectFieldProps
  extends Omit<NativeSelectProps, "ariaLabel" | "ariaDescribedBy" | "id" | "attrs" | "refCallback">,
    TerraFieldWrapperProps {
  /** Required: wires the label's `htmlFor` to the rendered `<select>`. */
  selectId: string;
  selectAttrs?: object;
}

/* -------------------------------------------------------------------------
 * terra-date-picker
 * ---------------------------------------------------------------------- */

/** All date props are ISO 8601 `YYYY-MM-DD` strings, not Date objects. */
export interface DatePickerProps {
  name: string;
  value?: string;
  selectedDate?: string;
  minDate?: string;
  maxDate?: string;
  excludeDates?: string[];
  includeDates?: string[];
  filterDate?: (date: unknown) => boolean;
  /** IANA zone (e.g. "America/Vancouver") used to interpret the value. */
  initialTimeZone?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  isIncomplete?: boolean;
  isInvalid?: boolean;
  isInline?: boolean;
  isDefaultDateAcceptable?: boolean;
  useExternalFormatMask?: boolean;
  inputAttributes?: object;
  errorId?: string;
  onChange?: (event: React.SyntheticEvent, date: string) => void;
  onChangeRaw?: (event: React.SyntheticEvent, value: string) => void;
  onSelect?: (event: React.SyntheticEvent, date: string) => void;
  onClickOutside?: (event: Event) => void;
  onRequestClose?: (event: Event) => void;
  onBlur?: React.FocusEventHandler;
  onFocus?: React.FocusEventHandler;
}

export interface DatePickerFieldProps
  extends Omit<
      DatePickerProps,
      "ariaLabel" | "initialTimeZone" | "isDefaultDateAcceptable" | "useExternalFormatMask" | "errorId"
    >,
    TerraFieldWrapperProps {
  /** Required: wires the label's `htmlFor` to the rendered input. */
  datePickerId: string;
  errorIcon?: React.ReactElement;
}

/**
 * terra-html-table. Every part is children-driven; the only knobs are on the
 * root. `paddingStyle: "compact"` is the right default inside a PowerChart
 * MPage, where vertical space is scarce.
 */
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  /** Zebra striping is on by default. */
  disableStripes?: boolean;
  paddingStyle?: "none" | "standard" | "compact";
}

/** `<thead>` / `<tbody>`. */
export interface TableSectionProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  children?: React.ReactNode;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children?: React.ReactNode;
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
}

export interface TableHeaderCellProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
}
