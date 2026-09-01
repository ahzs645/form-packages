import {
  Checkbox,
  Field,
  Heading,
  Hyperlink,
  Input,
  Radio,
  Textarea,
} from "@webforms/cerner-terra";
import type { BuilderChoiceOption, BuilderField } from "@webforms/form-model";
import React from "react";

import { resolveTerraControl, type TerraControl } from "./control-types";

/**
 * Renders one builder field with Terra components.
 *
 * Every control is stamped `data-terra-control` — the coverage test asserts
 * on it, exactly as the AlayaCare renderer does with
 * `data-alayacare-field-type`.
 */

export interface TerraFieldProps {
  field: BuilderField;
  value?: unknown;
  onChange?: (fieldId: string, value: unknown) => void;
  /** Render every control read-only (preview/print). */
  readOnly?: boolean;
}

function optionLabel(option: BuilderChoiceOption): string {
  return typeof option === "string" ? option : option.label;
}

function optionValue(option: BuilderChoiceOption): string {
  return typeof option === "string" ? option : (option.value ?? option.label);
}

function booleanOptions(field: BuilderField): BuilderChoiceOption[] {
  const labels = field.booleanLabels;
  return [
    { label: labels?.on ?? "Yes", value: "true" },
    { label: labels?.off ?? "No", value: "false" },
  ];
}

/** Terra's native select; the vendored set has no Select component yet. */
const NativeSelect: React.FC<{
  id: string;
  options: BuilderChoiceOption[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  onChange?: (value: string) => void;
}> = ({ id, options, value, placeholder, disabled, searchable, onChange }) => (
  <>
    <input
      list={searchable ? `${id}-options` : undefined}
      id={id}
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      hidden={!searchable}
      onChange={(event) => onChange?.(event.target.value)}
    />
    {searchable ? (
      <datalist id={`${id}-options`}>
        {options.map((option) => (
          <option key={optionValue(option)} value={optionValue(option)}>
            {optionLabel(option)}
          </option>
        ))}
      </datalist>
    ) : (
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">{placeholder ?? ""}</option>
        {options.map((option) => (
          <option key={optionValue(option)} value={optionValue(option)}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    )}
  </>
);

export const TerraField: React.FC<TerraFieldProps> = ({
  field,
  value,
  onChange,
  readOnly,
}) => {
  const { control, reason } = resolveTerraControl(field);
  const disabled = readOnly || field.disabled;
  const emit = (next: unknown) => onChange?.(field.id, next);
  const stamp = (node: React.ReactNode, kind: TerraControl) => (
    <div data-terra-control={kind} data-field-id={field.id}>
      {node}
    </div>
  );

  if (!control) {
    return (
      <div data-terra-control="unsupported" data-field-id={field.id}>
        <em>{field.label}</em> — {reason}
      </div>
    );
  }

  // Structural controls carry no Field wrapper.
  if (control === "section" || control === "heading") {
    return stamp(
      <Heading level={control === "section" ? 2 : 3} size="medium">
        {field.label}
      </Heading>,
      control,
    );
  }
  if (control === "hyperlink") {
    return stamp(
      <Hyperlink href={field.hyperlinkConfig?.href ?? "#"}>
        {field.hyperlinkConfig?.label ?? field.label}
      </Hyperlink>,
      control,
    );
  }
  if (control === "rich-text") {
    return stamp(<div>{field.richTextConfig?.source ?? field.label}</div>, control);
  }
  if (control === "component-placeholder") {
    return stamp(
      <div>
        <strong>{field.label}</strong>
        <div>
          Rendered by the MOIS component{" "}
          <code>{field.componentKey ?? "(unnamed)"}</code>; no Terra equivalent.
        </div>
      </div>,
      control,
    );
  }

  const fieldProps = {
    label: field.label,
    htmlFor: field.id,
    required: field.required,
    help: field.helpText,
    isInline: field.labelPosition === "left",
  };

  const inner = (() => {
    switch (control) {
      case "text":
      case "number":
      case "date":
      case "datetime":
      case "time":
        return (
          <Input
            id={field.id}
            type={
              control === "number"
                ? "number"
                : control === "date"
                  ? "date"
                  : control === "datetime"
                    ? "datetime-local"
                    : control === "time"
                      ? "time"
                      : field.type === "email"
                        ? "email"
                        : field.type === "phone"
                          ? "tel"
                          : "text"
            }
            value={(value as string) ?? ""}
            placeholder={field.placeholder}
            disabled={disabled}
            isIncomplete={field.required && !value}
            onChange={(event) => emit(event.target.value)}
          />
        );
      case "textarea":
        return (
          <Textarea
            id={field.id}
            value={(value as string) ?? ""}
            placeholder={field.placeholder}
            disabled={disabled}
            rows={field.textareaConfig?.rows ?? 4}
            onChange={(event) => emit(event.target.value)}
          />
        );
      case "computed-display":
        return <output id={field.id}>{(value as string) ?? "—"}</output>;
      case "checkbox":
        return (
          <Checkbox
            id={field.id}
            labelText={field.label}
            isLabelHidden
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => emit(event.target.checked)}
          />
        );
      case "radio-group": {
        const options =
          field.type === "booleanYesNo" ? booleanOptions(field) : (field.options ?? []);
        return (
          <>
            {options.map((option) => (
              <Radio
                key={optionValue(option)}
                id={`${field.id}-${optionValue(option)}`}
                name={field.id}
                labelText={optionLabel(option)}
                value={optionValue(option)}
                checked={value === optionValue(option)}
                disabled={disabled}
                onChange={() => emit(optionValue(option))}
              />
            ))}
          </>
        );
      }
      case "checkbox-group": {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        return (
          <>
            {(field.options ?? []).map((option) => (
              <Checkbox
                key={optionValue(option)}
                id={`${field.id}-${optionValue(option)}`}
                labelText={optionLabel(option)}
                value={optionValue(option)}
                checked={selected.includes(optionValue(option))}
                disabled={disabled}
                onChange={(event) =>
                  emit(
                    event.target.checked
                      ? [...selected, optionValue(option)]
                      : selected.filter((entry) => entry !== optionValue(option)),
                  )
                }
              />
            ))}
          </>
        );
      }
      case "select":
      case "select-search":
        return (
          <NativeSelect
            id={field.id}
            options={field.options ?? []}
            value={value as string | undefined}
            placeholder={field.placeholder}
            disabled={disabled}
            searchable={control === "select-search"}
            onChange={emit}
          />
        );
      case "table":
        return (
          <table>
            <thead>
              <tr>
                {(field.tableConfig?.columns ?? []).map((column) => (
                  <th key={column.id ?? column.label}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody />
          </table>
        );
      default:
        return null;
    }
  })();

  return stamp(<Field {...fieldProps}>{inner}</Field>, control);
};
