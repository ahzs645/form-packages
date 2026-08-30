import type { BuilderField, BuilderFieldType } from "./index";
import { BUILDER_FIELD_TYPES } from "./field-types";

export type BuilderAuthoringJsonSchema = Record<string, unknown>;

export interface BuilderFieldAuthoringContract {
  type: BuilderFieldType;
  properties: Record<string, BuilderAuthoringJsonSchema>;
  requiredProperties?: string[];
  defaultConfig?: Partial<BuilderField>;
  guidance?: string;
}

const stringArray = { type: "array", items: { type: "string" } };
const nullableObject = { type: ["object", "null"], additionalProperties: true };

export const BUILDER_FIELD_COMMON_AUTHORING_PROPERTIES: Record<string, BuilderAuthoringJsonSchema> = {
  label: { type: "string" },
  required: { type: "boolean" },
  hidden: { type: "boolean" },
  disabled: { type: "boolean" },
  width: { type: "string", enum: ["auto", "full", "1/2", "1/3", "2/3", "1/4", "3/4"] },
  labelPosition: { type: "string", enum: ["top", "left", "none"] },
  placeholder: { type: "string" },
  helpText: { type: "string" },
  helpPosition: { type: "string", enum: ["above_input", "below_input"] },
};

const SPECIALIZED_CONTRACTS: Partial<Record<BuilderFieldType, Omit<BuilderFieldAuthoringContract, "type">>> = {
  text: {
    properties: { textConfig: nullableObject },
    guidance: "Use textConfig for length limits or a visible suffix.",
  },
  email: {
    properties: { textConfig: nullableObject },
    guidance: "Email validation is provided by the field type; do not invent validation flags.",
  },
  url: {
    properties: { textConfig: nullableObject },
    guidance: "URL validation is provided by the field type; do not invent validation flags.",
  },
  password: {
    properties: { textConfig: nullableObject },
  },
  textarea: {
    properties: {
      textareaConfig: {
        type: ["object", "null"],
        properties: {
          rows: { type: "integer", minimum: 1 },
          maxCharLimit: { type: "integer", minimum: 1 },
          showCharLimit: { type: "boolean" },
          multiline: { type: "boolean" },
          borderless: { type: "boolean" },
          resizable: { type: "boolean" },
          labelPosition: { type: "string", enum: ["top", "left", "none"] },
        },
        additionalProperties: false,
      },
    },
    defaultConfig: {
      textareaConfig: {
        rows: 4,
        multiline: true,
        borderless: false,
        resizable: true,
        showCharLimit: false,
      },
    },
  },
  richText: {
    properties: { richTextConfig: nullableObject },
    defaultConfig: {
      richTextConfig: {
        source: "",
        readOnly: true,
        borderless: false,
        startingMode: "preview",
        height: null,
      },
    },
  },
  number: {
    properties: {
      numberConfig: {
        type: ["object", "null"],
        properties: {
          typeNumber: { type: "string", enum: ["number", "decimal", "year"] },
          suffix: { type: "string" },
          buttonControls: { type: "boolean" },
          storeAsNumber: { type: "boolean" },
          spinButtonProps: {
            type: "object",
            properties: {
              min: { type: "number" },
              max: { type: "number" },
              step: { type: "number" },
            },
            additionalProperties: false,
          },
        },
        required: ["typeNumber"],
        additionalProperties: false,
      },
    },
    guidance: "Use numberConfig.typeNumber for integer, decimal, or year behavior.",
  },
  computed: {
    properties: { computedConfig: nullableObject },
    defaultConfig: { computedConfig: { expression: "", resultType: "number" } },
    guidance: "computedConfig.expression references field IDs; resultType is number or text.",
  },
  choice: {
    properties: {
      options: {
        type: ["array", "null"],
        minItems: 1,
        items: {
          oneOf: [
            { type: "string" },
            {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
                score: { type: "number" },
              },
              additionalProperties: true,
            },
          ],
        },
      },
      choiceStyle: {
        type: "string",
        enum: ["dropdown", "radio", "multiselect", "checkbox", "simpleCodeSelect", "findCode"],
      },
      choiceAnswerLayout: {
        type: "string",
        enum: ["vertical", "responsive", "inline", "columns-2", "columns-3", "columns-4"],
      },
      codeSystem: { type: ["string", "null"] },
      showOtherOption: { type: "boolean" },
      autoHotKey: { type: "boolean" },
      allowCreation: { type: "boolean" },
      shuffleOptions: { type: "boolean" },
      minSelection: { type: "integer", minimum: 0 },
      maxSelection: { type: "integer", minimum: 1 },
    },
    requiredProperties: ["options", "choiceStyle"],
    defaultConfig: { options: ["Option 1", "Option 2"], choiceStyle: "findCode" },
    guidance: "Use choiceStyle=radio for one visible choice, checkbox for multiple visible choices, dropdown for one compact choice, and multiselect for multiple compact choices. Coded choices require an explicit codeSystem; ask rather than inventing one.",
  },
  booleanYesNo: {
    properties: {
      booleanLabels: {
        type: ["object", "null"],
        properties: { on: { type: "string" }, off: { type: "string" } },
        required: ["on", "off"],
        additionalProperties: false,
      },
      booleanNeutralMode: { type: "string", enum: ["cycle", "initial", "none"] },
      useToggleSwitch: { type: "boolean" },
    },
    defaultConfig: { booleanLabels: { on: "Yes", off: "No" } },
    guidance: "Use only for genuine binary concepts. Do not relabel it to represent unrelated alternatives such as Phone versus Email.",
  },
  booleanSingle: {
    properties: {
      booleanLabels: {
        type: ["object", "null"],
        properties: { on: { type: "string" }, off: { type: "string" } },
        required: ["on", "off"],
        additionalProperties: false,
      },
      useToggleSwitch: { type: "boolean" },
    },
    defaultConfig: {
      booleanLabels: { on: "Checked", off: "Unchecked" },
      useToggleSwitch: false,
    },
  },
  date: {
    properties: { dateConfig: nullableObject },
  },
  datetime: {
    properties: { dateConfig: nullableObject },
  },
  time: {
    properties: {
      timeConfig: {
        type: ["object", "null"],
        properties: { format: { type: "string", enum: ["12h", "24h"] } },
        required: ["format"],
        additionalProperties: false,
      },
    },
    defaultConfig: { timeConfig: { format: "24h" } },
  },
  phone: {
    properties: { phoneConfig: nullableObject },
  },
  hyperlink: {
    properties: { hyperlinkConfig: nullableObject },
    defaultConfig: {
      hyperlinkConfig: { href: "", label: "Open link", target: "_blank", displayStyle: "button" },
    },
  },
  rating: {
    properties: {
      ratingConfig: {
        type: ["object", "null"],
        properties: { maxStars: { type: "integer", minimum: 1, maximum: 10 } },
        required: ["maxStars"],
        additionalProperties: false,
      },
    },
    defaultConfig: { ratingConfig: { maxStars: 5 } },
  },
  slider: {
    properties: {
      sliderConfig: {
        type: ["object", "null"],
        properties: {
          min: { type: "number" },
          max: { type: "number" },
          step: { type: "number", exclusiveMinimum: 0 },
        },
        required: ["min", "max", "step"],
        additionalProperties: false,
      },
    },
    defaultConfig: { sliderConfig: { min: 0, max: 100, step: 1 } },
  },
  scale: {
    properties: { scaleConfig: nullableObject },
  },
  matrix: {
    properties: {
      matrixConfig: {
        type: ["object", "null"],
        properties: {
          rows: stringArray,
          columns: stringArray,
          multiplePerRow: { type: "boolean" },
          autoNumberRows: { type: "boolean" },
          rowLabelStyle: { type: "string", enum: ["numbers", "letters"] },
        },
        required: ["rows", "columns"],
        additionalProperties: false,
      },
    },
    guidance: "Prefer the dedicated createMatrix tool.",
  },
  table: {
    properties: { tableConfig: nullableObject },
    guidance: "Nested table authoring is complex; preserve existing tableConfig unless the request is explicit.",
  },
  layoutTable: {
    properties: { layoutTableConfig: nullableObject },
    guidance: "Exact printable table layout is complex; preserve existing layoutTableConfig unless the request is explicit.",
  },
  section: {
    properties: {
      sectionConfig: {
        type: ["object", "null"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          collapsible: { type: "boolean" },
          defaultCollapsed: { type: "boolean" },
          childFieldIds: stringArray,
          layoutType: { type: "string", enum: ["grid", "stacked"] },
          gridColumns: { type: "integer", minimum: 1, maximum: 4 },
        },
        required: ["childFieldIds"],
        additionalProperties: false,
      },
    },
    requiredProperties: ["sectionConfig"],
  },
  heading: {
    properties: {
      headingConfig: {
        type: ["object", "null"],
        properties: { childFieldIds: stringArray },
        required: ["childFieldIds"],
        additionalProperties: true,
      },
    },
  },
  file: {
    properties: { fileConfig: nullableObject },
    defaultConfig: { fileConfig: { accept: [], maxSize: 10 } },
  },
  barcode: {
    properties: { barcodeConfig: nullableObject },
  },
};

export const BUILDER_FIELD_AUTHORING_CONTRACTS: Readonly<Record<BuilderFieldType, BuilderFieldAuthoringContract>> =
  Object.fromEntries(
    BUILDER_FIELD_TYPES.map((type) => [
      type,
      {
        type,
        properties: SPECIALIZED_CONTRACTS[type]?.properties ?? {},
        requiredProperties: SPECIALIZED_CONTRACTS[type]?.requiredProperties,
        defaultConfig: SPECIALIZED_CONTRACTS[type]?.defaultConfig,
        guidance: SPECIALIZED_CONTRACTS[type]?.guidance,
      },
    ]),
  ) as Record<BuilderFieldType, BuilderFieldAuthoringContract>;

export function getBuilderFieldAuthoringContract(
  type: BuilderFieldType,
): BuilderFieldAuthoringContract {
  return BUILDER_FIELD_AUTHORING_CONTRACTS[type];
}

export function getBuilderFieldAuthoringDefaults(
  type: BuilderFieldType,
): Partial<BuilderField> {
  return structuredClone(BUILDER_FIELD_AUTHORING_CONTRACTS[type].defaultConfig ?? {});
}

export function buildBuilderFieldAuthoringSchema(
  type: BuilderFieldType,
  options: { patch?: boolean } = {},
): BuilderAuthoringJsonSchema {
  const contract = getBuilderFieldAuthoringContract(type);
  const properties = {
    ...BUILDER_FIELD_COMMON_AUTHORING_PROPERTIES,
    ...contract.properties,
    ...(options.patch
      ? {}
      : {
          id: { type: "string", description: "Stable unique snake_case field ID." },
          label: { type: "string" },
          type: { type: "string", const: type },
        }),
  };
  return {
    type: "object",
    properties,
    required: options.patch
      ? []
      : ["id", "label", "type", ...(contract.requiredProperties ?? [])],
    minProperties: options.patch ? 1 : undefined,
    additionalProperties: false,
  };
}

function schemaTypes(schema: BuilderAuthoringJsonSchema): string[] {
  return Array.isArray(schema.type)
    ? schema.type.filter((entry): entry is string => typeof entry === "string")
    : typeof schema.type === "string"
      ? [schema.type]
      : [];
}

function validateSchemaValue(
  value: unknown,
  schema: BuilderAuthoringJsonSchema,
  path: string,
): string[] {
  if (Array.isArray(schema.oneOf)) {
    const variants = schema.oneOf as BuilderAuthoringJsonSchema[];
    if (variants.some((variant) => validateSchemaValue(value, variant, path).length === 0)) {
      return [];
    }
    return [`${path} does not match any supported authoring shape.`];
  }
  if (schema.const !== undefined && value !== schema.const) {
    return [`${path} must equal ${JSON.stringify(schema.const)}.`];
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return [`${path} must be one of ${schema.enum.map(String).join(", ")}.`];
  }
  const types = schemaTypes(schema);
  if (value === null) {
    return types.includes("null") ? [] : [`${path} cannot be null.`];
  }
  if (types.includes("object")) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [`${path} must be an object.`];
    }
    const record = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, BuilderAuthoringJsonSchema>;
    const required = Array.isArray(schema.required) ? schema.required as string[] : [];
    const issues = required
      .filter((key) => record[key] === undefined)
      .map((key) => `${path}.${key} is required.`);
    if (schema.additionalProperties === false) {
      Object.keys(record)
        .filter((key) => !(key in properties))
        .forEach((key) => issues.push(`${path}.${key} is not an authorable property.`));
    }
    Object.entries(record).forEach(([key, entry]) => {
      if (properties[key]) issues.push(...validateSchemaValue(entry, properties[key], `${path}.${key}`));
    });
    const minProperties = typeof schema.minProperties === "number" ? schema.minProperties : 0;
    if (Object.keys(record).length < minProperties) {
      issues.push(`${path} must contain at least ${minProperties} property.`);
    }
    return issues;
  }
  if (types.includes("array")) {
    if (!Array.isArray(value)) return [`${path} must be an array.`];
    const minItems = typeof schema.minItems === "number" ? schema.minItems : 0;
    const issues = value.length < minItems
      ? [`${path} must contain at least ${minItems} item${minItems === 1 ? "" : "s"}.`]
      : [];
    const itemSchema = schema.items as BuilderAuthoringJsonSchema | undefined;
    if (itemSchema) {
      value.forEach((entry, index) => {
        issues.push(...validateSchemaValue(entry, itemSchema, `${path}[${index}]`));
      });
    }
    return issues;
  }
  if (types.includes("string") && typeof value !== "string") return [`${path} must be a string.`];
  if (types.includes("boolean") && typeof value !== "boolean") return [`${path} must be a boolean.`];
  if (types.includes("integer") && !Number.isInteger(value)) return [`${path} must be an integer.`];
  if (types.includes("number") && (typeof value !== "number" || !Number.isFinite(value))) {
    return [`${path} must be a number.`];
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      return [`${path} must be at least ${schema.minimum}.`];
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      return [`${path} must be at most ${schema.maximum}.`];
    }
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
      return [`${path} must be greater than ${schema.exclusiveMinimum}.`];
    }
  }
  return [];
}

export function validateBuilderFieldAuthoringValue(
  value: unknown,
  type: BuilderFieldType,
  options: { patch?: boolean; path?: string } = {},
): string[] {
  return validateSchemaValue(
    value,
    buildBuilderFieldAuthoringSchema(type, { patch: options.patch }),
    options.path ?? "field",
  );
}
