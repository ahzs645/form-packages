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
