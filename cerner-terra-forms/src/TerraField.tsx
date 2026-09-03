import {
  Button,
  Checkbox,
  DatePicker,
  Field,
  Heading,
  Hyperlink,
  Input,
  Radio,
  SearchSelect,
  Select,
  SelectOption,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
} from "@webforms/cerner-terra";
import type { BuilderChoiceOption, BuilderField } from "@webforms/form-model";
import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { resolveTerraControl, type TerraControl } from "./control-types";
import "./terra-fallbacks.css";

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

/**
 * Terra's own Select, in single or searchable form. Both render through
 * Hookshot into a portal, so the menu escapes any clipping container.
 */
const TerraSelect: React.FC<{
  id: string;
  options: BuilderChoiceOption[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  onChange?: (value: string) => void;
}> = ({ options, value, placeholder, disabled, searchable, onChange }) => {
  const Control = searchable ? SearchSelect : Select;
  return (
    // Terra's Select takes no id — the surrounding Field labels it. (Terra's
    // own SelectField is the accessible pairing; wire that in when this
    // target owns label rendering.)
    <Control
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(next: unknown) => onChange?.(String(next ?? ""))}
    >
      {options.map((option) => (
        <SelectOption
          key={optionValue(option)}
          value={optionValue(option)}
          display={optionLabel(option)}
        />
      ))}
    </Control>
  );
};

/**
 * A table cell renders the same control family as a standalone field, chosen
 * from the column's own type so a typed table stays typed.
 */
function renderTableCell(
  fieldId: string,
  rowIndex: number,
  column: { id?: string; label?: string; type?: string; options?: BuilderChoiceOption[] | null },
  disabled?: boolean,
): React.ReactNode {
  const cellId = `${fieldId}-${rowIndex}-${column.id ?? column.label ?? "col"}`;
  switch (column.type) {
    case "number":
      return <Input id={cellId} type="number" disabled={disabled} />;
    case "date":
      return <DatePicker name={cellId} disabled={disabled} />;
    case "time":
      return <Input id={cellId} type="time" disabled={disabled} />;
    case "checkbox":
    case "booleanYesNo":
      return (
        <Checkbox id={cellId} labelText={column.label ?? ""} isLabelHidden disabled={disabled} />
      );
    case "choice":
      return (
        <select id={cellId} disabled={disabled} defaultValue="">
          <option value="" />
          {(column.options ?? []).map((option) => (
            <option key={optionValue(option)} value={optionValue(option)}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      );
    default:
      return <Input id={cellId} type="text" disabled={disabled} />;
  }
}

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
    <div
      data-terra-control={kind}
      data-field-id={field.id}
      data-field-width={field.width && field.width !== "auto" ? field.width : undefined}
    >
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

  // Structural controls carry no Field wrapper. A section whose title is
  // hidden keeps its stamp — it still groups its children — but draws no
  // heading, as the MOIS target already does.
  if (control === "section" && field.sectionConfig?.hideTitle) {
    return stamp(null, control);
  }
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
    const source = field.richTextConfig?.source;
    // No label to paint, so a highlight paints the block.
    const blockStyle = field.labelStyle?.highlight ? { background: field.labelStyle.highlight } : undefined;
    return stamp(
      <div style={blockStyle}>
        {source ? <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown> : field.label}
      </div>,
      control,
    );
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

  // Terra spreads labelAttrs onto the <label>, which is where a form's own
  // label styling belongs — the same colours MOIS and PowerChart draw.
  const labelStyle: React.CSSProperties = {};
  if (field.labelStyle?.color) labelStyle.color = field.labelStyle.color;
  if (field.labelStyle?.highlight) labelStyle.background = field.labelStyle.highlight;
  if (field.labelStyle?.bold) labelStyle.fontWeight = 600;
  const fieldProps = {
    label: field.label,
    htmlFor: field.id,
    required: field.required,
    help: field.helpText,
    isInline: field.labelPosition === "left",
    ...(Object.keys(labelStyle).length > 0 ? { labelAttrs: { style: labelStyle } } : {}),
  };

  const inner = (() => {
    switch (control) {
      case "date":
        return (
          <DatePicker
            name={field.id}
            selectedDate={(value as string) ?? undefined}
            disabled={disabled}
            onChange={(_event, date) => emit(date)}
          />
        );
      case "text":
      case "number":
      case "datetime":
      case "time":
        return (
          <Input
            id={field.id}
            type={
              control === "number"
                ? "number"
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
          <TerraSelect
            id={field.id}
            options={field.options ?? []}
            value={value as string | undefined}
            placeholder={field.placeholder}
            disabled={disabled}
            searchable={control === "select-search"}
            onChange={emit}
          />
        );
      case "table": {
        const columns = field.tableConfig?.columns ?? [];
        const rowCount = Math.max(1, field.tableConfig?.initialRows ?? 1);
        const rows = Array.from({ length: rowCount }, (_, index) => index);
        return (
          <>
            <Table paddingStyle="compact">
              <TableHeader>
                {columns.map((column) => (
                  <TableHeaderCell key={column.id ?? column.label}>
                    {column.label}
                  </TableHeaderCell>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((column) => (
                      <TableCell key={column.id ?? column.label}>
                        {renderTableCell(field.id, rowIndex, column, disabled)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {field.tableConfig?.allowAddRows === false ? null : (
              <Button
                text={field.tableConfig?.addButtonText ?? "Add row"}
                variant="neutral"
                isCompact
                isDisabled={disabled}
              />
            )}
          </>
        );
      }
      default:
        return null;
    }
  })();

  return stamp(<Field {...fieldProps}>{inner}</Field>, control);
};
