// Generated from lib/address-entry.ts and scripts/templates/address-entry-field.jsx by scripts/generate-address-entry.mjs.
"use strict";
var AddressEntryRuntime = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // lib/address-entry.ts
  var address_entry_exports = {};
  __export(address_entry_exports, {
    addressPostalError: () => addressPostalError,
    formatAddressEntry: () => formatAddressEntry,
    normalizeAddressEntry: () => normalizeAddressEntry
  });

  // packages/form-model/src/field-types.ts
  var BUILDER_FIELD_TYPES = [
    "text",
    "number",
    "computed",
    "booleanYesNo",
    "booleanSingle",
    "date",
    "datetime",
    "choice",
    "table",
    "layoutTable",
    "component",
    "email",
    "phone",
    "url",
    "hyperlink",
    "textarea",
    "time",
    "rating",
    "slider",
    "signature",
    "file",
    "password",
    "richText",
    "scale",
    "matrix",
    "barcode",
    "provider",
    "section",
    "heading"
  ];
  function unionMembers() {
    return (list) => list;
  }
  var TABLE_COLUMN_TYPES = unionMembers()([
    "text",
    "number",
    "date",
    "time",
    "choice",
    "booleanYesNo",
    "checkbox",
    "stampButton"
  ]);
  var LAYOUT_CELL_INPUT_TYPES = unionMembers()([
    "text",
    "textarea",
    "number",
    "date",
    "time",
    "choice",
    "choiceMulti",
    "booleanYesNo",
    "booleanSingle"
  ]);
  var PARSED_FIELD_KINDS = unionMembers()([
    "text",
    "number",
    "boolean",
    "choice",
    "date",
    "time",
    "table",
    "layoutTable",
    "component",
    "rating",
    "slider",
    "scale",
    "matrix",
    "barcode",
    "file",
    "signature",
    "section",
    "heading"
  ]);

  // packages/form-model/src/report-formats.ts
  var REPORT_ITEM_FORMATS = {
    promptAnswer: {
      label: "Prompt and answer",
      description: "One \u201CPrompt: answer\u201D line per answered item, using each option\u2019s display text.",
      value: "answer",
      separator: ": ",
      indent: ""
    },
    promptScore: {
      label: "Prompt and score",
      description: "One indented \u201CPrompt : score\u201D line per answered item. This is also the shape MOIS\u2019s own calculator engine wrote, so these rows line up with observations carried over from a dynamic form.",
      value: "score",
      separator: " : ",
      indent: "    "
    }
  };
  var REPORT_ITEM_FORMAT_IDS = Object.keys(REPORT_ITEM_FORMATS);

  // packages/form-model/src/field-definitions.ts
  var BUILDER_FIELD_DEFINITIONS = [
    { type: "text", label: "Text", defaultLabel: "Text field", description: "Short free-text input", category: "input", palette: "primary" },
    { type: "textarea", label: "Long Text", defaultLabel: "Long text", description: "Multi-line text area", category: "input", palette: "primary" },
    // A rich-text block is its own content, so it starts without a caption
    // above it; the builder names it "Rich text N" until one is typed.
    { type: "richText", label: "Rich Text", defaultLabel: "", description: "Formatted markdown content", category: "input", palette: "primary" },
    { type: "number", label: "Number", defaultLabel: "Number", description: "Numeric input", category: "input", palette: "primary" },
    { type: "computed", label: "Computed", defaultLabel: "Computed", description: "Formula-derived value with configurable override behavior", category: "advanced", palette: "primary" },
    { type: "email", label: "Email", defaultLabel: "Email address", description: "Email address with validation", category: "input", palette: "primary" },
    { type: "phone", label: "Phone", defaultLabel: "Phone number", description: "Phone number input", category: "input", palette: "primary" },
    { type: "url", label: "URL", defaultLabel: "Web address", description: "Web address input", category: "input", palette: "primary" },
    { type: "hyperlink", label: "Hyperlink", defaultLabel: "Hyperlink", description: "Guideline link button", category: "media", palette: "primary" },
    { type: "booleanYesNo", label: "Yes / No", defaultLabel: "Yes / No question", description: "Radio pair (mutually exclusive)", category: "selection", palette: "primary" },
    { type: "booleanSingle", label: "Checkbox", defaultLabel: "Checkbox", description: "Single checkbox toggle", category: "selection", palette: "primary" },
    { type: "choice", label: "Choice", defaultLabel: "Choice", description: "Dropdown or radio/checkbox group", category: "selection", palette: "primary" },
    { type: "provider", label: "Provider Search", defaultLabel: "Provider", description: "Search the provider directory for a clinician", category: "selection", palette: "primary" },
    { type: "date", label: "Date", defaultLabel: "Date", description: "Calendar date picker", category: "input", palette: "primary" },
    { type: "time", label: "Time", defaultLabel: "Time", description: "Time picker (currently 24-hour)", category: "input", palette: "primary" },
    { type: "datetime", label: "Date & Time", defaultLabel: "Date & time", description: "Combined date and time picker", category: "input", palette: "primary" },
    { type: "scale", label: "Scale", defaultLabel: "Scale", description: "Numbered scale with labels", category: "advanced", palette: "primary" },
    { type: "matrix", label: "Matrix", defaultLabel: "Matrix", description: "Grid selection (rows \xD7 columns)", category: "advanced", palette: "primary" },
    { type: "layoutTable", label: "Layout Table", defaultLabel: "Layout Table", description: "Exact printable table-cell layout", category: "advanced", palette: "primary" },
    { type: "signature", label: "Signature", defaultLabel: "Signature", description: "Digital signature pad", category: "media", palette: "primary" },
    { type: "table", label: "Table", defaultLabel: "Table", description: "Multi-column rows", category: "advanced", palette: "primary" },
    { type: "component", label: "Component", defaultLabel: "Component", description: "Prebuilt component placeholder", category: "advanced", palette: "primary" },
    { type: "section", label: "Section", defaultLabel: "New section", description: "Group fields into a collapsible section", category: "advanced", palette: "primary" },
    { type: "heading", label: "Heading", defaultLabel: "Heading", description: "Less prominent heading that groups indented fields", category: "advanced", palette: "primary" },
    { type: "rating", label: "Rating", defaultLabel: "Rating", description: "Star rating (1-10)", category: "advanced", palette: "legacy" },
    { type: "slider", label: "Slider", defaultLabel: "Slider", description: "Numeric range slider", category: "advanced", palette: "legacy" },
    { type: "file", label: "File", defaultLabel: "File", description: "File upload", category: "media", palette: false },
    { type: "password", label: "Password", defaultLabel: "Password", description: "Secret text input", category: "input", palette: false },
    { type: "barcode", label: "Barcode", defaultLabel: "Barcode", description: "Barcode scanner", category: "media", palette: false }
  ];
  var definitionByType = new Map(
    BUILDER_FIELD_DEFINITIONS.map((definition) => [definition.type, definition])
  );

  // packages/form-model/src/field-authoring-contracts.ts
  var stringArray = { type: "array", items: { type: "string" } };
  var nullableObject = { type: ["object", "null"], additionalProperties: true };
  var SPECIALIZED_CONTRACTS = {
    text: {
      properties: { textConfig: nullableObject },
      guidance: "Use textConfig for length limits or a visible suffix."
    },
    email: {
      properties: { textConfig: nullableObject },
      guidance: "Email validation is provided by the field type; do not invent validation flags."
    },
    url: {
      properties: { textConfig: nullableObject },
      guidance: "URL validation is provided by the field type; do not invent validation flags."
    },
    password: {
      properties: { textConfig: nullableObject }
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
            labelPosition: { type: "string", enum: ["top", "left", "none"] }
          },
          additionalProperties: false
        }
      },
      defaultConfig: {
        textareaConfig: {
          rows: 4,
          multiline: true,
          borderless: false,
          resizable: true,
          showCharLimit: false
        }
      }
    },
    richText: {
      properties: { richTextConfig: nullableObject },
      defaultConfig: {
        richTextConfig: {
          source: "",
          readOnly: true,
          borderless: false,
          startingMode: "preview",
          height: null
        }
      }
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
                step: { type: "number" }
              },
              additionalProperties: false
            }
          },
          required: ["typeNumber"],
          additionalProperties: false
        }
      },
      guidance: "Use numberConfig.typeNumber for integer, decimal, or year behavior."
    },
    computed: {
      properties: { computedConfig: nullableObject },
      defaultConfig: { computedConfig: { expression: "", resultType: "number" } },
      guidance: "computedConfig.expression references field IDs. Supported keys: expression, precision (decimal places on the result \u2014 there is no decimalPlaces key), resultType (number|text), displaySuffix + showDisplaySuffix (presentation-only units), incompleteBehavior, incompleteText."
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
                  score: { type: "number" }
                },
                additionalProperties: true
              }
            ]
          }
        },
        choiceStyle: {
          type: "string",
          enum: ["dropdown", "radio", "multiselect", "checkbox", "simpleCodeSelect", "findCode"]
        },
        choiceAnswerLayout: {
          type: "string",
          enum: ["vertical", "responsive", "inline", "columns-2", "columns-3", "columns-4"]
        },
        codeSystem: { type: ["string", "null"] },
        showOtherOption: { type: "boolean" },
        autoHotKey: { type: "boolean" },
        allowCreation: { type: "boolean" },
        shuffleOptions: { type: "boolean" },
        minSelection: { type: "integer", minimum: 0 },
        maxSelection: { type: "integer", minimum: 1 }
      },
      requiredProperties: ["options", "choiceStyle"],
      defaultConfig: { options: ["Option 1", "Option 2"], choiceStyle: "findCode" },
      guidance: "Use choiceStyle=radio for one visible choice, checkbox for multiple visible choices, dropdown for one compact choice, and multiselect for multiple compact choices. Coded choices require an explicit codeSystem; ask rather than inventing one."
    },
    booleanYesNo: {
      properties: {
        booleanLabels: {
          type: ["object", "null"],
          properties: { on: { type: "string" }, off: { type: "string" } },
          required: ["on", "off"],
          additionalProperties: false
        },
        // "none" (Start as No) is retired: a starting answer is the default answer.
        booleanNeutralMode: { type: "string", enum: ["cycle", "initial"] },
        useToggleSwitch: { type: "boolean" }
      },
      defaultConfig: { booleanLabels: { on: "Yes", off: "No" } },
      guidance: "Use only for genuine binary concepts. Do not relabel it to represent unrelated alternatives such as Phone versus Email."
    },
    booleanSingle: {
      properties: {
        booleanLabels: {
          type: ["object", "null"],
          properties: { on: { type: "string" }, off: { type: "string" } },
          required: ["on", "off"],
          additionalProperties: false
        },
        useToggleSwitch: { type: "boolean" }
      },
      defaultConfig: {
        booleanLabels: { on: "Checked", off: "Unchecked" },
        useToggleSwitch: false
      }
    },
    date: {
      properties: { dateConfig: nullableObject }
    },
    datetime: {
      properties: { dateConfig: nullableObject }
    },
    time: {
      properties: {
        timeConfig: {
          type: ["object", "null"],
          properties: { format: { type: "string", enum: ["12h", "24h"] } },
          required: ["format"],
          additionalProperties: false
        }
      },
      defaultConfig: { timeConfig: { format: "24h" } }
    },
    phone: {
      properties: { phoneConfig: nullableObject }
    },
    hyperlink: {
      properties: { hyperlinkConfig: nullableObject },
      defaultConfig: {
        hyperlinkConfig: { href: "", label: "Open link", target: "_blank", displayStyle: "button" }
      }
    },
    rating: {
      properties: {
        ratingConfig: {
          type: ["object", "null"],
          properties: { maxStars: { type: "integer", minimum: 1, maximum: 10 } },
          required: ["maxStars"],
          additionalProperties: false
        }
      },
      defaultConfig: { ratingConfig: { maxStars: 5 } }
    },
    slider: {
      properties: {
        sliderConfig: {
          type: ["object", "null"],
          properties: {
            min: { type: "number" },
            max: { type: "number" },
            step: { type: "number", exclusiveMinimum: 0 }
          },
          required: ["min", "max", "step"],
          additionalProperties: false
        }
      },
      defaultConfig: { sliderConfig: { min: 0, max: 100, step: 1 } }
    },
    scale: {
      properties: { scaleConfig: nullableObject }
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
            rowLabelStyle: { type: "string", enum: ["numbers", "letters"] }
          },
          required: ["rows", "columns"],
          additionalProperties: false
        }
      },
      guidance: "Prefer the dedicated createMatrix tool."
    },
    table: {
      properties: { tableConfig: nullableObject },
      guidance: "Nested table authoring is complex; preserve existing tableConfig unless the request is explicit."
    },
    layoutTable: {
      properties: { layoutTableConfig: nullableObject },
      guidance: "Exact printable table layout is complex; preserve existing layoutTableConfig unless the request is explicit."
    },
    section: {
      defaultConfig: { sectionConfig: { childFieldIds: [], headingStyle: "subheading" } },
      properties: {
        sectionConfig: {
          type: ["object", "null"],
          properties: {
            title: { type: "string" },
            headingStyle: { type: "string", enum: ["main", "subheading", "none"] },
            hideTitle: { type: "boolean" },
            description: { type: "string" },
            collapsible: { type: "boolean" },
            defaultCollapsed: { type: "boolean" },
            childFieldIds: stringArray,
            layoutType: { type: "string", enum: ["grid", "stacked"] },
            gridColumns: { type: "integer", minimum: 1, maximum: 4 }
          },
          required: ["childFieldIds"],
          additionalProperties: false
        }
      },
      requiredProperties: ["sectionConfig"]
    },
    heading: {
      properties: {
        headingConfig: {
          type: ["object", "null"],
          properties: { childFieldIds: stringArray },
          required: ["childFieldIds"],
          additionalProperties: true
        }
      }
    },
    file: {
      properties: { fileConfig: nullableObject },
      defaultConfig: { fileConfig: { accept: [], maxSize: 10 } }
    },
    barcode: {
      properties: { barcodeConfig: nullableObject }
    }
  };
  var BUILDER_FIELD_AUTHORING_CONTRACTS = Object.fromEntries(
    BUILDER_FIELD_TYPES.map((type) => [
      type,
      {
        type,
        properties: SPECIALIZED_CONTRACTS[type]?.properties ?? {},
        requiredProperties: SPECIALIZED_CONTRACTS[type]?.requiredProperties,
        defaultConfig: SPECIALIZED_CONTRACTS[type]?.defaultConfig,
        guidance: SPECIALIZED_CONTRACTS[type]?.guidance
      }
    ])
  );

  // packages/form-model/src/investigation-tabs.ts
  var INVESTIGATION_FORM_TAB_NAMES = [
    "Physiology",
    "Medication",
    "History / Physical",
    "Investigation",
    "Review",
    "Information"
  ];
  var DEFAULT_INVESTIGATION_FORM_TABS = INVESTIGATION_FORM_TAB_NAMES.map((label, index) => ({
    id: `tab-${index + 1}`,
    label
  }));

  // packages/form-model/src/formula/registry.ts
  var support = (mois, cerner, alayacare, fhir, docmosis, documents = "native") => ({ mois, cerner, alayacare, fhir, docmosis, documents });
  var n = (name, extra = {}) => ({ name, type: "number", ...extra });
  var d = (name, extra = {}) => ({ name, type: "date", ...extra });
  var any = (name, extra = {}) => ({ name, type: "any", ...extra });
  var U = "unsupported";
  var C = "changed";
  var N = "native";
  var FORMULA_FUNCTIONS = [
    // ── Logic and missing values ────────────────────────────────────────────
    {
      name: "iif",
      aliases: [],
      category: "logic",
      params: [{ name: "test", type: "boolean" }, any("then"), any("else", { optional: true })],
      minArgs: 2,
      maxArgs: 3,
      result: "branches",
      lazy: true,
      missing: "handles",
      description: "`then` when the test holds, `else` (blank when omitted) when it does not, blank when the test is unknown. Parses to the conditional node, like `test ? then : else`.",
      engines: ["lib/expressions", "FormulaKit", "SubformScoring"],
      targets: support(N, C, C, N, C)
    },
    {
      name: "coalesce",
      aliases: [],
      category: "missing",
      params: [any("values", { rest: true })],
      minArgs: 1,
      maxArgs: null,
      result: "branches",
      lazy: true,
      missing: "handles",
      description: "The first argument that has a value, or blank.",
      engines: ["lib/expressions", "FormulaKit"],
      targets: support(N, C, C, N, C)
    },
    {
      name: "hasValue",
      aliases: [],
      category: "missing",
      params: [any("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "boolean",
      missing: "handles",
      description: "Whether the value is answered: false for blank, whitespace-only text and empty lists; true for `false` and `0`.",
      engines: ["lib/expressions", "FormulaKit"],
      targets: support(N, U, C, N, C)
    },
    {
      name: "ifPresent",
      aliases: [],
      category: "missing",
      params: [any("value"), any("then"), any("else", { optional: true })],
      minArgs: 2,
      maxArgs: 3,
      result: "branches",
      lazy: true,
      missing: "handles",
      description: "`then` when the value is answered, otherwise `else` (blank when omitted). From chart value formulas.",
      engines: ["chart-value"],
      targets: support(N, U, U, N, N)
    },
    {
      name: "countTrue",
      aliases: [],
      category: "logic",
      params: [any("values", { rest: true })],
      minArgs: 1,
      maxArgs: null,
      result: "number",
      missing: "handles",
      description: "How many values are yes: `true`, 1, and the text or codes true / Y / Yes (any case). Blank values count as not yes; lists are flattened.",
      engines: ["FormulaKit"],
      targets: support(N, U, U, N, U)
    },
    // ── Choices ─────────────────────────────────────────────────────────────
    {
      name: "score",
      aliases: [],
      category: "choice",
      params: [any("answer"), { name: "scores", type: "scoreMap", optional: true }],
      minArgs: 1,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "The score of a choice answer: looked up by code, then value, then label in the option score map (the field's own options when the map is omitted). A multi-select sums its choices; a checkbox scores 1 (or the given points) when checked and 0 when not; an answer with no score reads as its number, else 0.",
      engines: ["lib/expressions", "FormulaKit", "cerner-equation"],
      targets: support(N, N, N, N, U)
    },
    {
      name: "contains",
      aliases: [],
      category: "choice",
      params: [any("collection"), any("value")],
      minArgs: 2,
      maxArgs: 2,
      result: "boolean",
      missing: "handles",
      description: "List membership for lists and multi-select answers (coded answers match by code, value or label); case-insensitive substring for text. False when either side is blank.",
      engines: ["lib/expressions", "FormulaKit"],
      targets: support(N, U, U, N, U)
    },
    // ── Aggregates ──────────────────────────────────────────────────────────
    {
      name: "sum",
      aliases: [],
      category: "aggregate",
      params: [{ name: "values", type: "numbers", rest: true }],
      minArgs: 1,
      maxArgs: null,
      result: "number",
      missing: "handles",
      description: "The total of the answered values; lists are flattened, blanks are skipped, blank when nothing is answered.",
      engines: ["LayoutTable"],
      targets: support(N, C, N, N, U)
    },
    {
      name: "min",
      aliases: ["Math.min"],
      category: "aggregate",
      params: [{ name: "values", type: "numbers", rest: true }],
      minArgs: 1,
      maxArgs: null,
      result: "number",
      missing: "handles",
      description: "The smallest answered value; blanks are skipped, blank when nothing is answered.",
      engines: ["FormulaKit", "SubformScoring", "LayoutTable"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "max",
      aliases: ["Math.max"],
      category: "aggregate",
      params: [{ name: "values", type: "numbers", rest: true }],
      minArgs: 1,
      maxArgs: null,
      result: "number",
      missing: "handles",
      description: "The largest answered value; blanks are skipped, blank when nothing is answered.",
      engines: ["FormulaKit", "SubformScoring", "LayoutTable"],
      targets: support(N, U, U, N, U)
    },
    // ── Numbers ─────────────────────────────────────────────────────────────
    {
      name: "round",
      aliases: ["Math.round"],
      category: "math",
      params: [n("value"), n("digits", { optional: true })],
      minArgs: 1,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "Rounds to `digits` decimal places (0 when omitted; negative rounds to tens, hundreds\u2026). Halves round up (towards +\u221E), decimal-exact: round(1.005, 2) is 1.01.",
      engines: ["lib/expressions", "FormulaKit", "SubformScoring", "LayoutTable"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "floor",
      aliases: ["Math.floor"],
      category: "math",
      params: [n("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "The largest whole number not above the value.",
      engines: ["lib/expressions", "FormulaKit", "SubformScoring", "LayoutTable"],
      targets: support(N, C, U, N, C)
    },
    {
      name: "ceil",
      aliases: ["Math.ceil", "ceiling"],
      category: "math",
      params: [n("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "The smallest whole number not below the value.",
      engines: ["SubformScoring", "LayoutTable"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "trunc",
      aliases: ["Math.trunc", "truncate"],
      category: "math",
      params: [n("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "The whole-number part, dropping the fraction towards zero.",
      engines: ["LayoutTable"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "abs",
      aliases: ["Math.abs"],
      category: "math",
      params: [n("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "The absolute value.",
      engines: ["SubformScoring", "LayoutTable"],
      targets: support(N, C, U, N, U)
    },
    {
      name: "mod",
      aliases: [],
      category: "math",
      params: [n("value"), n("divisor")],
      minArgs: 2,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "The remainder of value \xF7 divisor, with the sign of the value (the `%` operator). Blank for a zero divisor.",
      engines: ["FormulaKit", "SubformScoring"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "power",
      aliases: ["Math.pow", "pow"],
      category: "math",
      params: [n("base"), n("exponent")],
      minArgs: 2,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "base raised to exponent (the `^` operator). Blank when the result is not a real number.",
      engines: ["lib/expressions", "FormulaKit", "LayoutTable", "cerner-equation"],
      targets: support(N, N, U, N, U)
    },
    {
      name: "sqrt",
      aliases: ["Math.sqrt", "SQR"],
      category: "math",
      params: [n("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "The square root; blank for a negative value. Cerner Equation Tool spells it SQR.",
      engines: ["LayoutTable", "cerner-equation"],
      targets: support(N, N, U, N, U)
    },
    {
      name: "ln",
      aliases: ["Math.log", "LOG", "log"],
      category: "math",
      params: [n("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "The natural logarithm; blank for zero or a negative value. Cerner Equation Tool spells it Log.",
      engines: ["lib/expressions", "FormulaKit", "LayoutTable", "cerner-equation"],
      targets: support(N, N, U, N, U)
    },
    {
      name: "log10",
      aliases: ["Math.log10", "LOG10"],
      category: "math",
      params: [n("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "The base-10 logarithm; blank for zero or a negative value.",
      engines: ["LayoutTable", "cerner-equation"],
      targets: support(N, N, U, N, U)
    },
    {
      name: "exp",
      aliases: ["Math.exp"],
      category: "math",
      params: [n("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "e raised to the value.",
      engines: ["lib/expressions", "FormulaKit", "LayoutTable"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "number",
      aliases: ["Number", "parseFloat", "toNumber"],
      category: "math",
      params: [any("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "The value read as a number (numeric text, a choice's numeric code, yes/no as 1/0); blank when it is not numeric.",
      engines: ["new"],
      targets: support(N, U, U, N, U)
    },
    // ── Text ────────────────────────────────────────────────────────────────
    {
      name: "text",
      aliases: ["String", "toString"],
      category: "text",
      params: [any("value")],
      minArgs: 1,
      maxArgs: 1,
      result: "text",
      missing: "handles",
      description: `The value as text: a choice's label, a date as YYYY-MM-DD, a list joined with ", ". Empty text when blank.`,
      engines: ["lib/expressions", "FormulaKit"],
      targets: support(N, U, U, N, N)
    },
    {
      name: "concat",
      aliases: [],
      category: "text",
      params: [any("parts", { rest: true })],
      minArgs: 1,
      maxArgs: null,
      result: "text",
      missing: "handles",
      description: 'Joins the parts as text (read like text()); blank parts add nothing, blank when every part is blank. Legacy `"a" + [x]` text joins parse to this.',
      engines: ["chart-value"],
      targets: support(N, U, U, N, N)
    },
    {
      name: "substring",
      aliases: [],
      category: "text",
      params: [any("text"), n("start"), n("length", { optional: true })],
      minArgs: 2,
      maxArgs: 3,
      result: "text",
      missing: "propagate",
      description: "Part of the text (read like text()) from character `start` (counted from 0), `length` characters long or to the end. Blank when `start` is outside the text, and when `length` is 0 or negative. FHIRPath substring().",
      engines: ["new"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "upper",
      aliases: [],
      category: "text",
      params: [any("text")],
      minArgs: 1,
      maxArgs: 1,
      result: "text",
      missing: "propagate",
      description: "The text (read like text()) in upper case. FHIRPath upper().",
      engines: ["new"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "lower",
      aliases: [],
      category: "text",
      params: [any("text")],
      minArgs: 1,
      maxArgs: 1,
      result: "text",
      missing: "propagate",
      description: "The text (read like text()) in lower case. FHIRPath lower().",
      engines: ["new"],
      targets: support(N, U, U, N, U)
    },
    {
      name: "replaceMatches",
      aliases: [],
      category: "text",
      params: [any("text"), { name: "regex", type: "text" }, { name: "substitution", type: "text" }],
      minArgs: 3,
      maxArgs: 3,
      result: "text",
      missing: "propagate",
      description: "The text (read like text()) with every match of the regular expression replaced by the substitution (`$1`, `$<name>` name a group; a blank substitution removes the matches). JavaScript regular expressions in single-line Unicode mode; a pattern that could take very long to match (nested or side-by-side repeats, back-references, look-around), an invalid one, or a text over 4,096 characters gives blank. FHIRPath replaceMatches().",
      engines: ["new"],
      targets: support(N, U, U, N, U)
    },
    // ── Dates ───────────────────────────────────────────────────────────────
    {
      name: "today",
      aliases: [],
      category: "date",
      params: [],
      minArgs: 0,
      maxArgs: 0,
      result: "date",
      missing: "handles",
      description: "Today's local calendar date.",
      engines: ["lib/expressions", "FormulaKit"],
      targets: support(N, C, U, N, C)
    },
    {
      name: "now",
      aliases: [],
      category: "date",
      params: [],
      minArgs: 0,
      maxArgs: 0,
      result: "datetime",
      missing: "handles",
      description: "The current date and time.",
      engines: ["new"],
      targets: support(N, C, U, N, U)
    },
    {
      name: "dateAdd",
      aliases: [],
      category: "date",
      params: [d("date"), n("amount"), { name: "unit", type: "unit" }],
      minArgs: 3,
      maxArgs: 3,
      // A date, or a date and time when `date` has a time (types.ts).
      result: "date",
      missing: "propagate",
      description: "The date moved by a whole number of days, weeks, months or years (negative moves back; a fraction is dropped), with FHIRPath calendar semantics: a month or year that lands on a day the month lacks gives the month's last day (31 January + 1 month is 28 or 29 February). A date and time keeps its time of day. FHIRPath `date + 2 years`.",
      engines: ["new"],
      targets: support(N, U, U, C, U)
    },
    {
      name: "durationBetween",
      aliases: [],
      category: "date",
      params: [d("from"), d("to", { optional: true }), { name: "unit", type: "unit", optional: true }],
      minArgs: 1,
      maxArgs: 3,
      result: "duration",
      missing: "handles",
      description: "Elapsed time from `from` to `to` (today when omitted or blank) in days, weeks, months or years (days when omitted). Date-only inputs count whole calendar days; a time on either side counts exact time. Weeks, months and years are exact fractions; floor() or round() them.",
      engines: ["lib/expressions", "FormulaKit"],
      targets: support(N, C, U, U, C)
    },
    {
      name: "durationText",
      aliases: [],
      category: "date",
      params: [d("from"), d("to", { optional: true }), { name: "units", type: "units", optional: true }],
      minArgs: 1,
      maxArgs: 3,
      result: "text",
      missing: "handles",
      description: 'A cascading breakdown such as "2 months, 3 weeks" over the listed units ("years,months" when omitted); `to` defaults to today. Empty text when a date is invalid.',
      engines: ["lib/expressions", "FormulaKit"],
      targets: support(N, U, U, U, U)
    },
    {
      name: "daysBetween",
      aliases: [],
      category: "date",
      params: [d("from"), d("to", { optional: true })],
      minArgs: 1,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "Whole calendar days from `from` to `to` (today when omitted); times of day are ignored.",
      engines: ["lib/expressions"],
      targets: support(N, C, U, U, U)
    },
    {
      name: "monthsBetween",
      aliases: [],
      category: "date",
      params: [d("from"), d("to", { optional: true })],
      minArgs: 1,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "Whole calendar months from `from` to `to` (today when omitted).",
      engines: ["lib/expressions"],
      targets: support(N, C, U, U, U)
    },
    {
      name: "daysSince",
      aliases: [],
      category: "date",
      params: [d("date"), d("reference", { optional: true })],
      minArgs: 1,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "Whole days from the date to the reference (now when omitted): calendar days when both are dates, else completed 24-hour days.",
      engines: ["FormulaKit"],
      targets: support(N, C, U, U, U)
    },
    {
      name: "monthsSince",
      aliases: [],
      category: "date",
      params: [d("date"), d("reference", { optional: true })],
      minArgs: 1,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "Whole calendar months from the date to the reference (now when omitted).",
      engines: ["FormulaKit"],
      targets: support(N, U, U, U, U)
    },
    {
      name: "weekdaysBetween",
      aliases: [],
      category: "date",
      params: [d("from"), d("to"), { name: "skip", type: "any", optional: true }],
      minArgs: 2,
      maxArgs: 3,
      result: "number",
      missing: "propagate",
      description: "Monday\u2013Friday days from `from` to `to`, counting both ends, less the weekday dates in `skip` (a list or comma-separated text). Blank when a date is missing or the range runs backwards.",
      engines: ["lib/expressions", "FormulaKit"],
      targets: support(N, U, U, U, U)
    },
    {
      name: "ageYears",
      aliases: [],
      category: "date",
      params: [d("birthDate"), d("asOf", { optional: true })],
      minArgs: 1,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "Completed years from the birth date to `asOf` (today when omitted or blank).",
      engines: ["new"],
      targets: support(N, C, U, U, C)
    },
    // ── Clinical ────────────────────────────────────────────────────────────
    {
      name: "bmi",
      aliases: [],
      category: "clinical",
      params: [n("weightKg"), n("heightCm")],
      minArgs: 2,
      maxArgs: 2,
      result: "number",
      missing: "propagate",
      description: "Body mass index: weight (kg) \xF7 height (m)\xB2; blank unless both are positive.",
      engines: ["lib/expressions"],
      targets: support(N, C, U, N, U)
    },
    {
      name: "zScore",
      aliases: [],
      category: "clinical",
      params: [any("measurement")],
      minArgs: 1,
      maxArgs: 1,
      result: "number",
      missing: "propagate",
      description: "A WHO/CDC growth z-score. Needs the growth reference tables, so the host supplies it through the evaluator's `functions`; blank without it.",
      engines: ["lib/expressions"],
      targets: support(U, U, U, U, U, "changed")
    },
    // ── The patient's chart ─────────────────────────────────────────────────
    {
      name: "latest",
      aliases: [],
      category: "chart",
      params: [{ name: "observation", type: "observation" }, { name: "options", type: "options", optional: true }],
      minArgs: 1,
      maxArgs: 2,
      // A number when the result is numeric, else its text or choice; a fallback gives its own type.
      result: "unknown",
      missing: "handles",
      description: 'The patient\'s latest charted result for an observation: `latest({"loinc": "29463-7"}, {"withinMinutes": 1440, "fallback": 0})`. The observation is named like a chart binding (`loinc`, `mois`, `dta` for a Cerner DTA, `system` + `code`, `concept`, and a `unit` results must be in); the options are `withinMinutes`, `aheadMinutes`, `statuses`, `fallback` and `required`. With no result in the window and no fallback it reads like an unanswered field, and a required result that is missing makes the formula incomplete. See chart-results.ts.',
      engines: ["cerner-equation", "new"],
      // MOIS: read by MOIS observation code (a LOINC or DTA through the crosswalk). Cerner: an equation component
      // over the DTA. FHIR: an x-fhir-query variable over a LOINC (or other queryable) code.
      targets: support(C, C, U, C, U, U)
    }
  ];
  var BY_NAME = /* @__PURE__ */ new Map();
  var BY_ALIAS = /* @__PURE__ */ new Map();
  var BY_LOWER = /* @__PURE__ */ new Map();
  for (const spec of FORMULA_FUNCTIONS) {
    BY_NAME.set(spec.name, spec);
    for (const alias of spec.aliases) BY_ALIAS.set(alias, spec);
  }
  for (const spec of FORMULA_FUNCTIONS) {
    for (const name of [spec.name, ...spec.aliases]) {
      const lower = name.toLowerCase();
      if (!BY_LOWER.has(lower)) BY_LOWER.set(lower, spec);
    }
  }
  var FORMULA_OPERATORS = [
    { op: "+", arity: 2, description: "Addition (numbers only; join text with concat()).", targets: support(N, N, N, N, U) },
    { op: "-", arity: 2, description: "Subtraction.", targets: support(N, N, U, N, U) },
    { op: "*", arity: 2, description: "Multiplication.", targets: support(N, N, C, N, U) },
    { op: "/", arity: 2, description: "Division; blank for a zero divisor.", targets: support(N, N, U, N, U) },
    { op: "%", arity: 2, description: "Remainder, like mod(); blank for a zero divisor.", targets: support(N, U, U, N, U) },
    { op: "^", arity: 2, description: "Power, like power().", targets: support(N, N, U, C, U) },
    { op: "==", arity: 2, description: "Equal (coded answers match by code, value or label; numeric text equals its number).", targets: support(N, N, U, N, C) },
    { op: "!=", arity: 2, description: "Not equal.", targets: support(N, C, U, N, C) },
    { op: "<", arity: 2, description: "Less than (numbers, dates, or text); unknown when a side is blank.", targets: support(N, N, U, N, U) },
    { op: "<=", arity: 2, description: "Less than or equal.", targets: support(N, N, U, N, U) },
    { op: ">", arity: 2, description: "Greater than.", targets: support(N, N, U, N, U) },
    { op: ">=", arity: 2, description: "Greater than or equal.", targets: support(N, N, U, N, U) },
    { op: "&&", arity: 2, description: "And (three-valued: false wins over unknown).", targets: support(N, N, C, N, U) },
    { op: "||", arity: 2, description: "Or (three-valued: true wins over unknown).", targets: support(N, N, C, N, U) },
    { op: "!", arity: 1, description: "Not; unknown stays unknown.", targets: support(N, U, U, N, C) },
    { op: "-", arity: 1, description: "Negation.", targets: support(N, N, C, N, U) },
    { op: "+", arity: 1, description: "Read as a number.", targets: support(N, C, U, C, U) },
    { op: "?:", arity: 3, description: "Conditional, like iif().", targets: support(N, C, C, N, C) }
  ];

  // packages/form-model/src/formula/evaluate.ts
  var CODED_KEYS = ["code", "key", "id", "display", "response", "label", "text"];
  var ANSWER_KEYS = [
    ...CODED_KEYS,
    "value",
    "selectedKey",
    "selectedIds",
    "selectedLabels",
    "coding",
    "valueCoding",
    "system",
    "date",
    "detailResponse"
  ];

  // packages/form-model/src/chart-facts.ts
  var CHART_FACT_AGE_IDS = {
    years: "chart:patient.ageYears",
    months: "chart:patient.ageMonths",
    weeks: "chart:patient.ageWeeks",
    days: "chart:patient.ageDays",
    hours: "chart:patient.ageHours"
  };
  var CHART_FACT_SEX_ID = "chart:patient.sex";
  var CHART_FACT_BIRTH_DATE_ID = "chart:patient.birthDate";
  var CHART_FACT_SEX_OPTIONS = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    { value: "other", label: "Other" },
    { value: "unknown", label: "Unknown" }
  ];
  var CHART_FACTS = [
    { id: CHART_FACT_SEX_ID, label: "Patient's sex (from the chart)", kind: "choice", options: CHART_FACT_SEX_OPTIONS },
    { id: CHART_FACT_AGE_IDS.years, label: "Patient's age in years (from the chart)", kind: "number" },
    { id: CHART_FACT_AGE_IDS.months, label: "Patient's age in months (from the chart)", kind: "number" },
    { id: CHART_FACT_AGE_IDS.weeks, label: "Patient's age in weeks (from the chart)", kind: "number" },
    { id: CHART_FACT_AGE_IDS.days, label: "Patient's age in days (from the chart)", kind: "number" },
    { id: CHART_FACT_AGE_IDS.hours, label: "Patient's age in hours (from the chart)", kind: "number" },
    { id: CHART_FACT_BIRTH_DATE_ID, label: "Patient's birth date (from the chart)", kind: "date" }
  ];
  var FACT_BY_ID = new Map(CHART_FACTS.map((fact) => [fact.id, fact]));

  // packages/form-model/src/validation.ts
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_PATTERN = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
  var URL_PATTERN = /^(?:https?:\/\/)?[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/i;
  var CA_POSTAL_PATTERN = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/;
  var MONEY_PATTERN = /^\$?\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;
  var PHN_WEIGHTS = [2, 4, 8, 5, 10, 9, 7, 3];
  function scalarText(value) {
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
    if (typeof value === "string") return value.trim();
    return null;
  }
  function matchesValueFormat(format, value) {
    switch (format) {
      case "bc-phn": {
        const text = scalarText(value);
        if (text === null) return false;
        const digits = text.replace(/[\s-]/g, "");
        if (!/^9\d{9}$/.test(digits)) return false;
        let sum = 0;
        for (let index = 0; index < PHN_WEIGHTS.length; index += 1) {
          sum += Number(digits[index + 1]) * PHN_WEIGHTS[index] % 11;
        }
        return 11 - sum % 11 === Number(digits[9]);
      }
      case "ca-postal":
        return typeof value === "string" && CA_POSTAL_PATTERN.test(value.trim().toUpperCase());
      case "money":
        if (typeof value === "number") {
          return Number.isFinite(value) && value >= 0 && Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
        }
        return typeof value === "string" && MONEY_PATTERN.test(value.trim());
      case "email":
      case "phone":
      case "url": {
        const text = scalarText(value);
        if (text === null) return true;
        const pattern = format === "email" ? EMAIL_PATTERN : format === "phone" ? PHONE_PATTERN : URL_PATTERN;
        return pattern.test(text);
      }
    }
  }

  // packages/form-model/src/workflow.ts
  var WORKFLOW_OUTPUT_KIND_LIST = [
    "dcoObservation",
    "documentComment",
    "calculatedObservation",
    "panelUpdate",
    "httpJson",
    "moisMutation",
    "documentUpdate",
    "webformUpdate",
    "customMutation"
  ];
  var EVERY_WORKFLOW_OUTPUT_KIND_READ = true;
  var WORKFLOW_OUTPUT_KINDS = new Set(EVERY_WORKFLOW_OUTPUT_KIND_READ ? WORKFLOW_OUTPUT_KIND_LIST : []);

  // lib/address-entry.ts
  function normalizeAddressEntry(value = {}) {
    const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
    const postal = clean(value.postalCode).toUpperCase();
    return { line1: clean(value.line1), line2: clean(value.line2), city: clean(value.city), province: clean(value.province), country: clean(value.country), postalCode: /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/.test(postal) ? postal.replace(/[ -]/g, "").replace(/^(.{3})(.{3})$/, "$1 $2") : postal };
  }
  function formatAddressEntry(value, options = {}) {
    const p = normalizeAddressEntry(value), country = options.omitDomesticCountry && [options.domesticCountry || "Canada", "CA", "CAN"].some((x) => x.toLowerCase() === p.country.toLowerCase()) ? "" : p.country;
    const locality = [p.city, p.province].filter(Boolean).join(", "), postal = options.separatePostalCode ? "" : p.postalCode;
    return options.compact ? [[p.line1, p.line2].filter(Boolean).join(", "), [locality, country, postal].filter(Boolean).join(" ")].filter(Boolean).join("\n") : [p.line1, p.line2, locality, [country, postal].filter(Boolean).join(" ")].filter(Boolean).join("\n");
  }
  function addressPostalError(value) {
    const p = normalizeAddressEntry(value);
    if (!p.postalCode) return null;
    const canadian = !p.country || ["canada", "ca", "can"].includes(p.country.toLowerCase());
    return canadian && !matchesValueFormat("ca-postal", p.postalCode) ? "Enter a valid Canadian postal code, like A1A 1A1." : null;
  }
  return __toCommonJS(address_entry_exports);
})();

// A form-local address editor. It never mutates a patient or associated party.
const AddressEntryField = ({ id = "addressEntry", fieldId = id, partsFieldId = `${fieldId}__address`, postalFieldId,
  label = "Address", compact = false, omitDomesticCountry = false, domesticCountry = "Canada", textFlowSlots,
  readOnly = false, disabled = false, allowPrintOverride = true }) => {
  const [fd, setFd] = useActiveData()
  const data = fd?.field?.data || {}
  const stored = data[partsFieldId]
  const parts = { line1: "", line2: "", city: "", province: "", country: "", ...(stored || {}), postalCode: stored?.postalCode ?? (postalFieldId ? data[postalFieldId] || "" : "") }
  const oldText = typeof data[fieldId] === "string" ? data[fieldId] : ""
  const locked = readOnly || disabled
  const options = { compact, separatePostalCode: !!postalFieldId, omitDomesticCountry, domesticCountry }
  const write = (patch) => {
    if (locked || !setFd) return
    setFd(produce((draft) => {
      draft.field = draft.field || { data: {} }
      draft.field.data = draft.field.data || {}
      const values = draft.field.data
      const previous = values[partsFieldId] || { postalCode: postalFieldId ? values[postalFieldId] : "", previousFormatted: values[fieldId] || "" }
      const next = { ...previous, ...patch }
      const normalized = AddressEntryRuntime.normalizeAddressEntry(next)
      values[partsFieldId] = next
      values[fieldId] = next.printOverrideEnabled ? String(next.printOverride || "") : AddressEntryRuntime.formatAddressEntry(normalized, options)
      if (postalFieldId) values[postalFieldId] = normalized.postalCode
    }))
  }
  const full = AddressEntryRuntime.formatAddressEntry(parts)
  const error = AddressEntryRuntime.addressPostalError(parts)
  return <div data-address-entry={id} style={{ margin: "8px 0" }}>
    <div style={{ fontWeight: 600, marginBottom: 8 }}>{label}</div>
    {!stored && oldText ? <div style={{ marginBottom: 8 }}>Existing address retained. Enter the address parts to replace it: <span style={{ whiteSpace: "pre-wrap" }}>{oldText}</span></div> : null}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px 16px" }}>
      {[["line1","Address Line 1"],["line2","Address Line 2"],["city","City"],["postalCode","Postal code"],["province","Province"],["country","Country"]].map(([key, title]) =>
        <div key={key} style={key === "line1" || key === "line2" ? { gridColumn: "1 / -1" } : undefined}>
          <Fluent.TextField label={title} value={parts[key]} readOnly={locked} disabled={disabled}
            errorMessage={key === "postalCode" ? error || undefined : undefined}
            onChange={(_event, value) => write({ [key]: value || "" })} />
        </div>)}
    </div>
    {full ? <div style={{ marginTop: 12 }}><b>Full address</b><div style={{ whiteSpace: "pre-wrap" }}>{full}</div></div> : null}
    {allowPrintOverride ? <div style={{ marginTop: 10 }}>
      <Fluent.Checkbox label="Use a shorter address for the PDF" checked={!!stored?.printOverrideEnabled} disabled={locked}
        onChange={(_event, checked) => write({ printOverrideEnabled: !!checked, printOverride: stored?.printOverride ?? oldText })} />
      {stored?.printOverrideEnabled ? <Fluent.TextField label="PDF address wording" value={stored.printOverride || ""} multiline rows={2} readOnly={locked}
        onChange={(_event, value) => write({ printOverride: value || "" })} /> : null}
    </div> : null}
    {Array.isArray(textFlowSlots) && textFlowSlots.length > 1
      ? <PdfTextFlowField fieldId={fieldId} label="Address for the PDF" multiline rows={2} readOnly size="max" textFlowSlots={textFlowSlots} textFlowOverflow="block" />
      : <div style={{ marginTop: 10 }}><b>Address for printing</b><div style={{ whiteSpace: "pre-wrap" }}>{oldText}</div></div>}
    <p style={{ fontSize: 12, marginTop: 6 }}>The full address stays in the form. Check the PDF line preview; shorten the PDF wording if it does not fit. {postalFieldId ? "Postal code prints in its separate box." : ""}</p>
  </div>
}
