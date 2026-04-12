type PreviewAjvError = {
  instancePath: string;
  keyword: string;
  message: string;
};

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  anyOf?: JsonSchema[];
};

function normalizeTypes(value: JsonSchema["type"]): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function getRuntimeType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function isTypeMatch(value: unknown, expectedType: string): boolean {
  if (expectedType === "integer") return Number.isInteger(value);
  if (expectedType === "number") return typeof value === "number" && Number.isFinite(value);
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (expectedType === "null") return value === null;
  return typeof value === expectedType;
}

function joinPath(basePath: string, key: string | number): string {
  if (typeof key === "number") {
    return `${basePath}/${key}`;
  }
  return `${basePath}/${key}`;
}

function validateAgainstSchema(
  schema: JsonSchema | undefined,
  value: unknown,
  instancePath: string,
  errors: PreviewAjvError[]
): boolean {
  if (!schema || typeof schema !== "object") {
    return true;
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const anyOfMatches = schema.anyOf.some((branch) => {
      const branchErrors: PreviewAjvError[] = [];
      return validateAgainstSchema(branch, value, instancePath, branchErrors);
    });

    if (!anyOfMatches) {
      errors.push({
        instancePath,
        keyword: "anyOf",
        message: "must match at least one allowed schema",
      });
      return false;
    }
  }

  const expectedTypes = normalizeTypes(schema.type);
  if (expectedTypes.length > 0) {
    const matched = expectedTypes.some((expectedType) => isTypeMatch(value, expectedType));
    if (!matched) {
      errors.push({
        instancePath,
        keyword: "type",
        message: `must be ${expectedTypes.join(" or ")} (received ${getRuntimeType(value)})`,
      });
      return false;
    }
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0 && !schema.enum.includes(value)) {
    errors.push({
      instancePath,
      keyword: "enum",
      message: `must be one of ${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}`,
    });
    return false;
  }

  if (Array.isArray(schema.required) && schema.required.length > 0) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push({
        instancePath,
        keyword: "required",
        message: "must be an object to satisfy required properties",
      });
      return false;
    }

    schema.required.forEach((requiredKey) => {
      if (!(requiredKey in (value as Record<string, unknown>))) {
        errors.push({
          instancePath,
          keyword: "required",
          message: `must have required property '${requiredKey}'`,
        });
      }
    });
  }

  if (schema.properties && value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(schema.properties).forEach(([propertyKey, propertySchema]) => {
      const nextValue = (value as Record<string, unknown>)[propertyKey];
      if (nextValue === undefined) return;
      validateAgainstSchema(propertySchema, nextValue, joinPath(instancePath, propertyKey), errors);
    });
  }

  if (schema.items && Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateAgainstSchema(schema.items, entry, joinPath(instancePath, index), errors);
    });
  }

  return errors.length === 0;
}

export class PreviewAjv {
  errors: PreviewAjvError[] | null = null;

  constructor(_options?: unknown) {}

  validate(schema: JsonSchema, data: unknown): boolean {
    const errors: PreviewAjvError[] = [];
    const isValid = validateAgainstSchema(schema, data, "", errors);
    this.errors = errors.length > 0 ? errors : null;
    return isValid;
  }

  compile(schema: JsonSchema) {
    return (data: unknown) => this.validate(schema, data);
  }
}
