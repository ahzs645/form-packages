const { ChoiceGroup, DefaultButton, Dropdown, FontIcon, IconButton, MaskedTextField, PrimaryButton, TextField } = Fluent;

const printStyles = `
  @media print {
    .hideonprint { display: none !important; }
    .showonprint { display: block !important; }
    .pagebreak { page-break-before: always; }
    div { page-break-inside: avoid; }
  }
  .showonprint { display: none; }`

const workflowConditionPasses = (data, condition) => {
  if (!condition || !condition.fieldId) return true;
  const raw = data[condition.fieldId];
  const toCode = (entry) => entry && typeof entry === "object"
    ? (entry.code ?? entry.value ?? entry.display ?? entry.text)
    : entry;
  const codes = (Array.isArray(raw) ? raw : [raw])
    .map(toCode)
    .filter((entry) => entry !== undefined && entry !== null && entry !== "")
    .map(String);
  const values = (Array.isArray(condition.values) ? condition.values : []).map(String);
  switch (condition.operator || "truthy") {
    case "equals": return codes.some((code) => code === String(condition.value));
    case "notEquals": return !codes.some((code) => code === String(condition.value));
    case "yes": return codes.some((code) => code === "Y" || code === "true" || code === "Yes");
    case "no": return !codes.some((code) => code === "Y" || code === "true" || code === "Yes");
    case "in": return codes.some((code) => values.includes(code));
    case "notIn": return !codes.some((code) => values.includes(code));
    default: return codes.length > 0 && codes.some((code) => code !== "false" && code !== "N");
  }
};
const resolveOutputCondition = (item) => item.condition
  ?? (item.conditionalFieldId
    ? {
        fieldId: item.conditionalFieldId,
        operator: item.conditionalValues?.length ? "in" : "truthy",
        values: item.conditionalValues,
      }
    : null);

const buildDcoUpdates = (sd, fd, map) => {
  if (!map?.length) return [];
  const data = fd.field?.data || {};
  const updates = [];
  const currentWebformId = Number(sd.webform?.webformId ?? sd.formParams?.webformId ?? 0) || 0;
  const webformObservations = Array.isArray(sd.webform?.observations) ? sd.webform.observations : [];
  const patientObservations = Array.isArray(sd.queryResult?.patient?.[0]?.observations) ? sd.queryResult.patient[0].observations : [];
  const observationSourceWebformId = (obs) => Number(obs?.sourceWebformId ?? obs?.webformId ?? obs?.webform?.webformId ?? 0) || 0;
  const matchesObservation = (obs, item, requireWebformLink = false) => {
    if (!obs || obs.observationCode !== item.observationCode) return false;
    const sourceWebformId = observationSourceWebformId(obs);
    if (requireWebformLink && (!sourceWebformId || !currentWebformId)) return false;
    return !sourceWebformId || !currentWebformId || sourceWebformId === currentWebformId;
  };
  const normalizeMappedObservationValue = (value, item) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    if ((item.valueType || "TEXT") === "NUMERIC") {
      const numeric = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }
    const normalizeCoded = (entry) => {
      if (entry === undefined || entry === null) return null;
      if (typeof entry !== "object") return entry;
      if (item.valueSource === "code") return entry.code ?? entry.value ?? entry.display ?? entry.text ?? JSON.stringify(entry);
      return entry.display ?? entry.text ?? entry.value ?? entry.code ?? JSON.stringify(entry);
    };
    if (Array.isArray(value)) return value.map(normalizeCoded).filter((entry) => entry !== undefined && entry !== null && entry !== "").join(", ");
    if (typeof value === "object") return normalizeCoded(value);
    return value;
  };
  const normalizeMappedDisplayValue = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (Array.isArray(value)) return value.map(normalizeMappedDisplayValue).filter(Boolean).join(", ");
    if (typeof value === "object") return value.display ?? value.text ?? value.value ?? value.code ?? JSON.stringify(value);
    return value;
  };
  const normalizeMappedTextValue = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return value.display ?? value.text ?? value.value ?? value.code ?? JSON.stringify(value);
    return value;
  };
  const normalizeMappedUnitsCode = (value) => {
    if (value === undefined || value === null || value === "") return "";
    if (Array.isArray(value)) return value.map(normalizeMappedUnitsCode).filter(Boolean).join(", ");
    if (typeof value === "object") return value.code ?? value.value ?? value.display ?? value.text ?? JSON.stringify(value);
    return String(value);
  };
  const normalizeMappedCodeValue = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (Array.isArray(value)) return value.map(normalizeMappedCodeValue).filter(Boolean).join(", ");
    if (typeof value === "object") return value.code ?? value.value ?? value.display ?? value.text ?? JSON.stringify(value);
    return String(value);
  };
  const renderMappedReportTemplate = (template, rawValue, commentValue) => {
    const display = String(normalizeMappedDisplayValue(rawValue) ?? "");
    const code = String(normalizeMappedCodeValue(rawValue) ?? "");
    return String(template || "{display}")
      .replaceAll("{display}", display)
      .replaceAll("{code}", code)
      .replaceAll("{value}", code || display)
      .replaceAll("{comment}", String(commentValue ?? ""));
  };
  map.forEach((item) => {
    const oldObs = webformObservations.find(o => matchesObservation(o, item))
      ?? patientObservations.find(o => matchesObservation(o, item, true));
    const oldId = oldObs?.observationId ?? 0;
    const rawValue = data[item.fieldId];
    const value = normalizeMappedObservationValue(rawValue, item);
    const conditionalPass = workflowConditionPasses(data, resolveOutputCondition(item));
    if (!conditionalPass) {
      if (item.deleteWhenFalse && oldId) { updates.push({ observationId: -oldId }); }
      return;
    }
    const hasValue = value !== undefined && value !== null && value !== "";
    if (hasValue) {
      const unitsCode = item.unitsFieldId ? normalizeMappedUnitsCode(data[item.unitsFieldId]) : "";
      const persistedValue = item.staticValue !== undefined ? item.staticValue : value;
      updates.push({
        observationId: oldId,
        observationCode: item.observationCode,
        ...(item.loincCode ? { loincCode: item.loincCode } : {}),
        observationClass: "DCOBS",
        value: item.unitsInline ? String(persistedValue) + unitsCode : persistedValue,
        valueType: item.valueType || "TEXT",
        status: oldId ? "C" : "F",
        sourceWebformId: currentWebformId || undefined,
        description: item.description,
        report: item.reportTemplate
          ? renderMappedReportTemplate(item.reportTemplate, rawValue, item.commentFieldId ? normalizeMappedTextValue(data[item.commentFieldId]) : "")
          : (item.reportFromDisplay ? normalizeMappedDisplayValue(rawValue) : (item.reportFieldId ? normalizeMappedTextValue(data[item.reportFieldId]) : undefined)),
        units: item.unitsInline ? "" : (item.unitsFieldId ? (normalizeMappedTextValue(data[item.unitsFieldId]) || item.units) : item.units),
        rangeAbsurdLow: item.rangeAbsurdLow,
        rangeNormalLow: item.rangeNormalLow,
        rangeNormalHigh: item.rangeNormalHigh,
        rangeAbsurdHigh: item.rangeAbsurdHigh,
        referenceRangeText: item.referenceRangeText,
        orderedBy: data.createdBy ?? sd.userProfile?.identity?.fullName,
        collectedBy: data.createdBy ?? sd.userProfile?.identity?.fullName,
        collectedDateTime: getDateTimeString(new Date())
      });
    } else if (item.deleteWhenFalse && oldId) {
      updates.push({ observationId: -oldId });
    }
  });
  return updates;
};

const builderWorkflow = {};
const workflowFieldLabels = {};
const normalizeWorkflowTextValue = (value) => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(normalizeWorkflowTextValue).filter(Boolean).join(", ");
  if (typeof value === "object") return value.display ?? value.text ?? value.value ?? value.code ?? JSON.stringify(value);
  return String(value);
};
const getWorkflowPathValue = (root, path) => {
  if (!path) return "";
  return String(path).split(".").filter(Boolean).reduce((current, key) => {
    if (current == null) return undefined;
    if (Array.isArray(current) && /^\\d+$/.test(key)) return current[Number(key)];
    return current[key];
  }, root);
};
const renderWorkflowTemplate = (template, data, context) => {
  const scope = context || {};
  return String(template || "")
    .replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, path, body) => {
      const rows = getWorkflowPathValue(data, String(path).trim());
      if (!Array.isArray(rows)) return "";
      return rows.map((item, index) => renderWorkflowTemplate(body, data, { ...scope, this: item, index: index + 1 })).join("");
    })
    .replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey) => {
      const key = String(rawKey).trim();
      if (key === "index") return String(scope.index ?? "");
      if (key === "this") return normalizeWorkflowTextValue(scope.this);
      if (key.startsWith("this.")) return normalizeWorkflowTextValue(getWorkflowPathValue(scope.this, key.slice(5)));
      return normalizeWorkflowTextValue(getWorkflowPathValue(data, key));
    })
    .replace(/\{([^{}]+)\}/g, (_, rawKey) => normalizeWorkflowTextValue(getWorkflowPathValue(data, String(rawKey).trim())));
};
const reportItemFormats = {"promptAnswer":{"separator":": ","indent":""},"promptScore":{"separator":" : ","indent":"    "}};
const buildWorkflowReports = (fd) => {
  const data = fd.field?.data || {};
  const reports = {};
  (builderWorkflow.reports || []).forEach((report) => {
    if (report.kind === "template" && report.template) {
      reports[report.id] = renderWorkflowTemplate(report.template, data);
      return;
    }
    const lines = [];
    const indented = report.valueLayout === "indented";
    const itemFormat = reportItemFormats[report.itemFormat] || reportItemFormats.promptAnswer;
    const pushField = (fieldId) => {
      const labelOverride = report.fieldLabels && report.fieldLabels[fieldId];
      const label = labelOverride || (report.labelSource === "fieldId"
        ? fieldId
        : (workflowFieldLabels[fieldId] || fieldId));
      const raw = data[fieldId];
      const value = normalizeWorkflowTextValue(raw);
      if (indented) {
        if (!value && !report.emptyText) return;
        lines.push(label + ":");
        if (Array.isArray(raw) && raw.length) {
          raw.forEach((entry) => lines.push("- " + normalizeWorkflowTextValue(entry)));
        } else {
          lines.push("  " + (value || report.emptyText).replace(/\n/g, "\n  "));
        }
        lines.push("");
        return;
      }
      if (value) {
        lines.push(itemFormat.indent + label + itemFormat.separator + value.replace(/\n/g, "\n  "));
      } else if (report.emptyText) {
        lines.push(itemFormat.indent + label + itemFormat.separator + report.emptyText);
      }
    };
    if (Array.isArray(report.sections) && report.sections.length) {
      report.sections.forEach((section) => {
        const before = lines.length;
        (section.fieldIds || []).forEach(pushField);
        const headingOnly = !(section.fieldIds || []).length && section.title;
        if ((lines.length > before || headingOnly) && section.title) {
          const underline = report.headerStyle === "underlined"
            ? (section.level === "sub" ? "-" : "=")
            : null;
          const header = underline
            ? [section.title, underline.repeat(section.title.length)]
            : [section.title];
          lines.splice(before, 0, ...header);
        }
        if (lines.length > before && report.sectionSpacing === "spaced" && lines[lines.length - 1] !== "") lines.push("");
      });
    } else {
      (report.fieldIds || []).forEach(pushField);
    }
    reports[report.id] = lines.join("\n");
  });
  return reports;
};
const buildWorkflowUpdates = (sd, fd, reports) => {
  const data = fd.field?.data || {};
  const dcoMap = (builderWorkflow.outputs || [])
    .filter((output) => output.kind === "dcoObservation" && output.enabled !== false && output.observationCode)
    .map((output) => ({
      fieldId: output.valueFieldId || output.id,
      observationCode: output.observationCode,
      loincCode: output.loincCode,
      description: output.description || output.title,
      valueType: output.valueType === "numeric" ? "NUMERIC" : (output.valueType || "TEXT"),
      valueSource: output.valueSource,
      reportFromDisplay: output.reportFromDisplay,
      deleteWhenFalse: output.deleteWhenFalse,
      reportFieldId: output.reportFieldId,
      units: output.units,
      unitsFieldId: output.unitsFieldId,
      unitsInline: output.unitsInline,
      rangeAbsurdLow: output.rangeAbsurdLow,
      rangeNormalLow: output.rangeNormalLow,
      rangeNormalHigh: output.rangeNormalHigh,
      rangeAbsurdHigh: output.rangeAbsurdHigh,
      condition: output.condition,
      __workflowOutput: output,
    }));
  const derivedData = { ...data };
  dcoMap.forEach((item) => {
    const output = item.__workflowOutput;
    if (output.valueFieldId) {
      derivedData[item.fieldId] = data[output.valueFieldId];
    } else if (output.value !== undefined) {
      derivedData[item.fieldId] = output.value;
    }
    if (output.reportId && reports[output.reportId]) {
      const reportKey = output.reportFieldId || output.reportId;
      item.reportFieldId = reportKey;
      derivedData[reportKey] = reports[output.reportId];
    }
  });
  const workflowFd = { ...fd, field: { ...(fd.field || {}), data: derivedData } };
  return { DCOUpdates: dcoMap.length ? buildDcoUpdates(sd, workflowFd, dcoMap) : [] };
};

const resolveMoisPathValue = (root, path) => {
  if (!root || !path) return undefined;
  const steps = String(path).split(".").filter(Boolean);
  let current = root;
  for (const step of steps) {
    if (Array.isArray(current)) {
      current = current
        .map((entry) => (entry && typeof entry === "object" ? entry[step] : undefined))
        .filter((entry) => entry !== undefined && entry !== null);
      if (current.length === 0) return undefined;
      continue;
    }
    if (current && typeof current === "object") {
      current = current[step];
      if (current === undefined || current === null) return current;
      continue;
    }
    return undefined;
  }
  return current;
};

const resolvePositiveMoisId = (...values) => {
  for (const value of values) {
    const candidate = Number(value);
    if (Number.isFinite(candidate) && candidate > 0) return candidate;
  }
  return undefined;
};

const buildEncounterNoteUpdates = (sd, fd) => {
  const data = fd.field?.data || {};
  const root = { sd, fd, data, patient: sd.patient, webform: sd.webform, formData: data };
  const resolveMaybePath = (value) => (typeof value === "string" && value.indexOf("sd.") === 0 ? resolveMoisPathValue(root, value) : value);
  return (builderWorkflow.outputs || [])
    .filter((output) => output.kind === "moisMutation" && output.enabled !== false && output.resource === "encounterNote")
    .map((output) => {
      const noteField = output.payloadFields && output.payloadFields.note;
      const noteText = noteField ? data[noteField] : undefined;
      if (noteText == null || String(noteText).trim() === "") return null;
      const defaults = output.payloadDefaults || {};
      const extraInfoTemplate = defaults.extraInfoTemplate;
      const existing = ((sd.webform && sd.webform.encounter && sd.webform.encounter.notes) || [])
        .find((entry) => entry && entry.extraInfoTemplate === extraInfoTemplate)
        || { encounterNoteId: defaults.encounterNoteId != null ? defaults.encounterNoteId : 0, authorUserProfileId: sd.auth && sd.auth.userProfileId, creatorUserProfileId: sd.auth && sd.auth.userProfileId, isComplete: defaults.isComplete };
      const configuredEncounterId = resolveMaybePath(defaults.encounterId);
      const encounterId = resolvePositiveMoisId(
        configuredEncounterId,
        sd.formParams?.encounterId,
        sd.webform?.encounterId,
        sd.webform?.encounter?.encounterId
      );
      const configuredPatientId = resolveMaybePath(output.patientIdPath);
      const patientId = resolvePositiveMoisId(
        configuredPatientId,
        sd.formParams?.patientId,
        sd.patient?.patientId,
        sd.webform?.patientId
      );
      return {
        mutation: output.mutation || "changeEncounterNote",
        patientId,
        encounterNote: Object.assign({}, existing, { encounterId, note: noteText, extraInfoTemplate }),
      };
    })
    .filter(Boolean);
};

const buildWorkflowPanelUpdates = (sd, fd) => {
  const data = fd.field?.data || {};
  const buildWorkflowPanelRows = (output) => {
    const bindings = Array.isArray(output.payload?.rowBindings) ? output.payload.rowBindings : [];
    if (!bindings.length) {
      return output.valueFieldId ? data[output.valueFieldId] : undefined;
    }
    return bindings
      .map((binding, index) => {
        const source = binding.fieldId ? data[binding.fieldId] : undefined;
        const scaleAnswer = source && typeof source === "object" && Object.prototype.hasOwnProperty.call(source, "selectedKey") ? source : null;
        const raw = scaleAnswer ? scaleAnswer.value : source;
        const isEmpty = scaleAnswer ? (scaleAnswer.selectedKey === undefined || scaleAnswer.selectedKey === null || scaleAnswer.selectedKey === "") : (raw === undefined || raw === null || raw === "");
        if (isEmpty && !output.payload?.includeEmptyRows) return null;
        const coded = scaleAnswer || (typeof raw === "object" && (raw.code !== undefined || raw.display !== undefined));
        const row = {
          description: binding.description,
          observationCode: binding.observationCode,
          ...(binding.loincCode ? { loincCode: binding.loincCode } : {}),
          observationClass: "DCOBS",
          panelSequenceNumber: binding.panelSequenceNumber ?? index + 1,
          valueType: binding.valueType || (coded ? "VALUESET" : (typeof raw === "number" || !Number.isNaN(Number(raw)) ? "NUMERIC" : "TEXT")),
          status: "F",
          units: binding.units,
          rangeNormalLow: binding.rangeNormalLow,
          rangeNormalHigh: binding.rangeNormalHigh,
          rangeAbsurdLow: binding.rangeAbsurdLow,
          rangeAbsurdHigh: binding.rangeAbsurdHigh,
          referenceRangeText: binding.referenceRangeText,
        };
        if (isEmpty && row.valueType === "VALUESET") {
          row.codedValue = { code: null, display: null, system: binding.system };
        } else if (isEmpty) {
          row.value = null;
        } else if (scaleAnswer) {
          row.codedValue = { code: String(scaleAnswer.selectedKey), display: scaleAnswer.response ?? String(scaleAnswer.selectedKey), system: binding.system ?? scaleAnswer.system };
        } else if (coded) {
          row.codedValue = { code: raw.code, display: raw.display ?? raw.code, system: binding.system ?? raw.system };
        } else if (row.valueType === "VALUESET") {
          row.codedValue = { code: String(raw), display: String(raw), system: binding.system };
        } else {
          row.value = raw;
        }
        return row;
      })
      .filter(Boolean);
  };
  return (builderWorkflow.outputs || [])
    .filter((output) => output.kind === "panelUpdate" && output.enabled !== false && output.payload && output.payload.panelName && output.payload.panelName.code)
    .map((output) => {
      if (!workflowConditionPasses(data, resolveOutputCondition(output))) return null;
      const rows = buildWorkflowPanelRows(output);
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const { rowBindings: _rowBindings, includeEmptyRows: _includeEmptyRows, ...header } = output.payload || {};
      const boundHeaderValue = (key) => {
        const fieldId = output.payloadFields && output.payloadFields[key];
        const value = fieldId ? normalizeWorkflowTextValue(data[fieldId]) : "";
        return value ? value : undefined;
      };
      const boundOrderedBy = boundHeaderValue("orderedBy");
      const boundFacility = boundHeaderValue("facility");
      const existingPanels = Array.isArray(sd.webform?.observationPanels) ? sd.webform.observationPanels : [];
      const existing = existingPanels.find((panel) => panel?.panelName?.code === header.panelName.code) ?? existingPanels[0];
      const notesFieldId = output.payloadFields && output.payloadFields.notes;
      const notes = notesFieldId ? data[notesFieldId] : undefined;
      return Object.assign({
        observationPanelId: existing?.observationPanelId ?? 0,
        collectedDate: getDateTimeString(new Date()),
        reportedDate: getDateTimeString(new Date()),
        orderedBy: boundOrderedBy ?? data.createdBy ?? sd.userProfile?.identity?.fullName,
        status: "F",
        observations: rows,
      }, header, notes != null && notes !== "" ? { notes } : null, boundFacility ? { facility: boundFacility } : null);
    })
    .filter(Boolean);
};

const hasMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

// __componentPayloads is runtime staging (DCO/webform updates per
// component); it must not be serialized into the saved formdata.
const stripComponentPayloads = (data) => {
  if (!data || typeof data !== "object") return data || {};
  const { __componentPayloads, ...rest } = data;
  return rest;
};

const normalizeMoisObservationInput = (observation) => {
  if (!observation || typeof observation !== "object") return observation;
  const { sourceWebformId: _sourceWebformId, linkedWebformId: _linkedWebformId, webformId: _webformId, webform: _webform, ...input } = observation;
  if (!Object.prototype.hasOwnProperty.call(input, "value") || input.value == null) return input;
  return { ...input, value: typeof input.value === "string" ? input.value : String(input.value) };
};
const normalizeMoisObservationPanelInput = (panel) => {
  if (!panel || typeof panel !== "object" || !Array.isArray(panel.observations)) return panel;
  return { ...panel, observations: panel.observations.map(normalizeMoisObservationInput) };
};

const collectComponentPayloads = (fd) => {
  const payloads = fd?.field?.data?.__componentPayloads;
  const dcoGroups = payloads?.dcoUpdatesByComponent || {};
  const webformGroups = payloads?.webformUpdatesByComponent || {};
  const DCOUpdates = Object.values(dcoGroups).flatMap((entry) => Array.isArray(entry) ? entry : []);
  const panelUpdates = Object.values(webformGroups).flatMap((entry) => Array.isArray(entry?.panelUpdates) ? entry.panelUpdates : []);
  const narratives = Object.values(webformGroups).flatMap((entry) => Array.isArray(entry?.narratives) ? entry.narratives : []);
  const panels = panelUpdates.length ? panelUpdates : undefined;
  const linkedPanels = panelUpdates.length ? panelUpdates : undefined;
  const webformUpdate = narratives.length ? { narratives } : null;
  return { DCOUpdates, webformUpdate, panels, linkedPanels, narratives: narratives.length ? narratives : undefined };
};

const renderDocumentCommentTemplate = (template, field, value, data) => {
  const text = template || "{label}: {value}";
  const displayValue = value && typeof value === "object"
    ? (value.display ?? value.text ?? value.value ?? value.code ?? JSON.stringify(value))
    : value;
  return String(text)
    .replaceAll("{fieldId}", field.fieldId || "")
    .replaceAll("{label}", field.label || field.fieldId || "")
    .replaceAll("{value}", displayValue == null ? "" : String(displayValue))
    .replace(/\{data\.([^}]+)\}/g, (_, path) => {
      const resolved = resolveMoisPathValue(data, path);
      return resolved == null ? "" : String(resolved);
    });
};

const buildDocumentComment = (fd, map) => {
  if (!map?.length) return "";
  const data = fd?.field?.data || {};
  return map
    .map((field) => {
      if (!workflowConditionPasses(data, resolveOutputCondition(field))) return "";
      const value = field.fieldId ? data[field.fieldId] : undefined;
      if (!field.staticComment && !hasMeaningfulValue(value)) return "";
      return renderDocumentCommentTemplate(field.template, field, value, data);
    })
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
};

const normalizeAutoFillValue = (rawValue, currentValue) => {
  const normalizeSingle = (value) => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeSingle(entry)).filter((entry) => entry !== undefined);
    }
    if (typeof value === "object") {
      if (value.display !== undefined && value.display !== null) return value.display;
      if (value.text !== undefined && value.text !== null) return value.text;
      if (value.value !== undefined && value.value !== null) return value.value;
      if (value.code !== undefined && value.code !== null) return value.code;
      return undefined;
    }
    return value;
  };

  const normalized = normalizeSingle(rawValue);
  if (Array.isArray(normalized)) {
    const flattened = normalized
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((entry) => entry !== undefined && entry !== null && entry !== "");
    if (flattened.length === 0) return undefined;
    return Array.isArray(currentValue) ? flattened : flattened[0];
  }

  if (typeof normalized === "string" && normalized.trim() === "") return undefined;
  return normalized;
};

const formatAutoFillAddress = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  if (value.text) return String(value.text);
  const streetLines = Array.isArray(value.line) ? value.line : [value.line1, value.line2];
  const cityLine = [value.city, value.province || value.state].filter(Boolean).join(", ");
  const countryLine = [value.country, value.postalCode || value.zipCode].filter(Boolean).join(" ");
  return [...streetLines, cityLine, countryLine].filter(Boolean).join("\n");
};

const formatAutoFillInsurance = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const insurerSource = value.insuranceBy || value.healthNumberBy;
  const insurer = insurerSource && typeof insurerSource === "object" ? insurerSource.code || insurerSource.display : insurerSource;
  const number = value.insuranceNumber || value.healthNumber;
  const lines = [];
  if (insurer && number) lines.push(String(insurer) + ": " + String(number));
  else if (insurer || number) lines.push(String(insurer || number));
  if (value.insuranceDependent) lines.push("Dep: " + String(value.insuranceDependent));
  return lines.join("\n");
};

const formatAutoFillTelecom = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const lines = [];
  if (value.homePhone) lines.push("Home: " + value.homePhone + " Leave msg: " + (value.homeMessage === "Y" ? "Yes" : "No"));
  if (value.workPhone) lines.push("Work: " + value.workPhone + (value.workExt ? " Ext: " + value.workExt : ""));
  if (value.cellPhone) lines.push("Cell: " + value.cellPhone);
  const email = value.homeEmail || value.email;
  if (email) lines.push("Email: " + email);
  return lines.join("\n");
};

const applyAutoFillValueTransform = (rawValue, valueTransform) => {
  if (valueTransform === "exists") return hasMeaningfulValue(rawValue) ? true : undefined;
  if (valueTransform === "string") return rawValue === undefined || rawValue === null ? undefined : String(rawValue);
  if (valueTransform === "address") return formatAutoFillAddress(rawValue);
  if (valueTransform === "insurance") return formatAutoFillInsurance(rawValue);
  if (valueTransform === "telecom") return formatAutoFillTelecom(rawValue);
  return rawValue;
};

const sortObservationsByCollectedDateTime = (observations) => {
  if (!Array.isArray(observations)) return observations;
  return [...observations].sort((a, b) => {
    const aTime = Date.parse(a?.collectedDateTime ?? "") || 0;
    const bTime = Date.parse(b?.collectedDateTime ?? "") || 0;
    return bTime - aTime;
  });
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
};

const getDatePart = (value, part) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(value.trim());
  if (!match) return undefined;
  const year = match[1];
  const month = String(match[2]).padStart(2, "0");
  const day = String(match[3]).padStart(2, "0");
  if (part === "year") return year;
  if (part === "month") return month;
  if (part === "day") return day;
  if (part === "ageYears") {
    const birthDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(birthDate.getTime())) return undefined;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
    return age;
  }
  return undefined;
};

const normalizeFilterComparable = (value) => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
const parseFilteredMoisPath = (path) => {
  const match = /^(.+?)\[([^=\]]+)=([^\]]*)\](?:\.(.*))?$/.exec(String(path || ""));
  if (!match) return null;
  const collectionPath = String(match[1] || "").trim();
  const filterPath = String(match[2] || "").trim();
  const filterValue = String(match[3] || "").trim();
  if (!collectionPath || !filterPath || !filterValue) return null;
  return { collectionPath, filterPath, filterValue, restPath: String(match[4] || "").trim() };
};

const resolveFilteredMoisCollection = (sd, sourcePath) => {
  const parsed = parseFilteredMoisPath(sourcePath);
  if (!parsed) return undefined;
  let collection = parsed.collectionPath === "patient.observations"
    ? sortObservationsByCollectedDateTime(resolveMoisPathValue(sd, "patient.observations") ?? resolveMoisPathValue(sd?.queryResult?.patient?.[0], "observations"))
    : resolveMoisPathValue(sd, parsed.collectionPath);
  if ((collection === undefined || collection === null) && parsed.collectionPath.startsWith("patient.")) {
    collection = resolveMoisPathValue(sd?.queryResult?.patient?.[0], parsed.collectionPath.slice("patient.".length));
  }
  if (!Array.isArray(collection)) return undefined;
  const expected = normalizeFilterComparable(parsed.filterValue);
  const filtered = collection.filter((entry) => {
    const direct = resolveMoisPathValue(entry, parsed.filterPath);
    if (normalizeFilterComparable(direct) === expected) return true;
    if (parsed.collectionPath === "patient.observations" && parsed.filterPath === "observationCode") {
      return [entry?.description, entry?.loincCode, entry?.codedValue?.code, entry?.codedValue?.display]
        .some((candidate) => normalizeFilterComparable(candidate) === expected);
    }
    return false;
  });
  if (!parsed.restPath) return filtered;
  return resolveMoisPathValue(filtered, parsed.restPath);
};

const getMoisAutoFillValue = (sd, sourcePath) => {
  if (!sourcePath) return undefined;
  if (sourcePath === "system.currentDate") return formatLocalDate(new Date());
  if (String(sourcePath).startsWith("system.currentDate.")) {
    return getDatePart(formatLocalDate(new Date()), String(sourcePath).slice("system.currentDate.".length));
  }
  if (sourcePath === "patient.allergies.noneKnown") {
    const allergies = resolveMoisPathValue(sd, "patient.allergies") ?? resolveMoisPathValue(sd?.queryResult?.patient?.[0], "allergies");
    return Array.isArray(allergies) ? allergies.length === 0 : undefined;
  }
  if (sourcePath === "patient.name.middleInitial") {
    const middle = resolveMoisPathValue(sd, "patient.name.middle") ?? resolveMoisPathValue(sd?.queryResult?.patient?.[0], "name.middle");
    return typeof middle === "string" && middle.trim() ? middle.trim().charAt(0) : undefined;
  }
  if (sourcePath === "patient.name.givenNames") {
    const first = resolveMoisPathValue(sd, "patient.name.first") ?? resolveMoisPathValue(sd?.queryResult?.patient?.[0], "name.first");
    const middle = resolveMoisPathValue(sd, "patient.name.middle") ?? resolveMoisPathValue(sd?.queryResult?.patient?.[0], "name.middle");
    const names = [first, middle].filter((part) => typeof part === "string" && part.trim()).map((part) => part.trim()).join(" ");
    return names || undefined;
  }
  if (String(sourcePath).startsWith("patient.birthDate.")) {
    const birthDate = resolveMoisPathValue(sd, "patient.birthDate") ?? resolveMoisPathValue(sd?.queryResult?.patient?.[0], "birthDate");
    return getDatePart(birthDate, String(sourcePath).slice("patient.birthDate.".length));
  }
  const filteredValue = resolveFilteredMoisCollection(sd, sourcePath);
  if (filteredValue !== undefined) return filteredValue;
  // Observation bindings mean "most recent": chart order is not
  // guaranteed chronological, so sort by collectedDateTime first.
  if (sourcePath === "patient.observations" || sourcePath.startsWith("patient.observations.")) {
    const observations = sortObservationsByCollectedDateTime(
      resolveMoisPathValue(sd, "patient.observations") ??
      resolveMoisPathValue(sd?.queryResult?.patient?.[0], "observations")
    );
    const rest = sourcePath.slice("patient.observations.".length);
    if (!rest || sourcePath === "patient.observations") return observations;
    return resolveMoisPathValue(observations, rest);
  }
  const directValue = resolveMoisPathValue(sd, sourcePath);
  if (directValue !== undefined && directValue !== null) return directValue;
  if (sourcePath.startsWith("patient.")) {
    return resolveMoisPathValue(sd?.queryResult?.patient?.[0], sourcePath.slice("patient.".length));
  }
  return undefined;
};

const oscarSummaryScalar = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) return value.map(oscarSummaryScalar).filter(Boolean).join(", ");
  if (typeof value === "object") {
    for (const key of ["display", "text", "name", "value", "code"]) {
      const formatted = oscarSummaryScalar(value[key]);
      if (formatted) return formatted;
    }
  }
  return "";
};
const uniqueOscarSummaryParts = (parts) => Array.from(new Set(parts.map(oscarSummaryScalar).filter(Boolean)));
const formatOscarClinicalSummary = (value, kind) => {
  const rows = Array.isArray(value) ? value : [value];
  return rows.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return oscarSummaryScalar(entry);
    if (kind === "allergies") {
      const name = oscarSummaryScalar(entry.substance ?? entry.atcName ?? entry.medication ?? entry.name ?? entry);
      const details = uniqueOscarSummaryParts([entry.reactions, entry.intoleranceType, entry.comment]);
      return name + (details.length ? " — " + details.join("; ") : "");
    }
    if (kind === "conditions") {
      const name = oscarSummaryScalar(entry.condition ?? entry.problem ?? entry.diagnosis ?? entry.name ?? entry);
      const details = uniqueOscarSummaryParts([entry.severity, entry.certainty, entry.comment, entry.resolveDate ? "Resolved " + oscarSummaryScalar(entry.resolveDate) : ""]);
      return name + (details.length ? " — " + details.join("; ") : "");
    }
    const narrative = oscarSummaryScalar(entry.prescriptionNarrative);
    if (narrative) return narrative;
    const name = oscarSummaryScalar(entry.medication ?? entry.genericName ?? entry.name ?? entry);
    const directions = uniqueOscarSummaryParts([entry.dose, entry.route, entry.frequency]).join(" ");
    const details = uniqueOscarSummaryParts([directions, entry.indication, entry.comment]);
    return name + (details.length ? " — " + details.join("; ") : "");
  }).filter(Boolean).join("\n");
};

const applyAutoFillSourceFormat = (value, format) => {
  if (value === undefined || value === null || !format) return value;
  if (format === "coding") {
    if (typeof value === "object" && !Array.isArray(value)) {
      return value.code ?? value.value ?? value.display ?? value.text ?? undefined;
    }
    return value;
  }
  if (format === "date") {
    const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(String(value).trim());
    if (!match) return value;
    return match[1] + "-" + String(match[2]).padStart(2, "0") + "-" + String(match[3]).padStart(2, "0");
  }
  if (format === "oscarAllergies") return formatOscarClinicalSummary(value, "allergies");
  if (format === "oscarConditions") return formatOscarClinicalSummary(value, "conditions");
  if (format === "oscarMedications") return formatOscarClinicalSummary(value, "medications");
  return value;
};

const applyMoisAutoFill = (sd, data, map) => {
  if (!map || Object.keys(map).length === 0) return data || {};
  const next = { ...(data || {}) };
  Object.entries(map).forEach(([fieldId, bindingConfig]) => {
    const binding = typeof bindingConfig === "string" ? { sourcePath: bindingConfig } : bindingConfig || {};
    if (binding.mode !== "copy" && hasMeaningfulValue(next[fieldId])) return;
    const candidatePaths = [binding.sourcePath, ...(Array.isArray(binding.sourcePaths) ? binding.sourcePaths : [])]
      .filter((path) => typeof path === "string" && path.trim());
    let rawValue = undefined;
    for (const path of candidatePaths) {
      const candidate = getMoisAutoFillValue(sd, path);
      if (hasMeaningfulValue(candidate)) {
        rawValue = candidate;
        break;
      }
    }
    const transformedValue = applyAutoFillValueTransform(rawValue, binding.valueTransform);
    const formattedValue = applyAutoFillSourceFormat(transformedValue, binding.format);
    let resolvedValue = normalizeAutoFillValue(formattedValue, next[fieldId]);
    if (resolvedValue === undefined && binding.fallback !== undefined && binding.fallback !== null) {
      resolvedValue = binding.fallback;
    }
    if (resolvedValue !== undefined) {
      next[fieldId] = resolvedValue;
    }
  });
  return next;
};

Query = `query FormQuery ($patientId: Int) {
  patient(id: $patientId) {
    ${Mois.Query.fullChartFields}
    
  }
}`;

Schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Form Data",
  "type": "object",
  "definitions": {
    "coding": {
      "type": "object",
      "properties": {
        "code": {
          "type": [
            "string",
            "null"
          ]
        },
        "display": {
          "type": [
            "string",
            "null"
          ]
        },
        "system": {
          "type": [
            "string",
            "null"
          ]
        }
      }
    },
    "codings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "code": {
            "type": [
              "string",
              "null"
            ]
          },
          "display": {
            "type": [
              "string",
              "null"
            ]
          },
          "system": {
            "type": [
              "string",
              "null"
            ]
          }
        }
      }
    },
    "date": {
      "type": [
        "string",
        "null"
      ]
    },
    "selectedItems": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {},
        "additionalProperties": true
      }
    }
  },
  "properties": {
    "visit_date": {
      "$ref": "#/definitions/date"
    },
    "reason": {
      "type": [
        "string",
        "null"
      ]
    },
    "notes": {
      "type": [
        "string",
        "null"
      ]
    },
    "followup": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "visit_date",
    "reason"
  ]
};

InitialData = {
  "visit_section": null,
  "visit_date": null,
  "reason": null,
  "assessment_section": null,
  "notes": "",
  "followup": null,
  "_form": {
    "name": "cerner-player-demo",
    "version": "1.0.0",
    "mappingKey": "cerner-player-demo@1.0.0"
  }
};

const bindingContract = {
  "bindings": [],
  "localWriteTargets": [],
  "warnings": [],
  "moduleSemantics": {
    "navigationTargets": [],
    "persistedObservationTargets": [],
    "documentCommentTargets": [],
    "writeBindings": [],
    "measurementObservationWrites": [],
    "componentPayloadSource": "__componentPayloads",
    "activeDataRoot": "fd.field.data",
    "statusDataRoot": "fd.field.status"
  }
};

const initialAuthorshipTargetRegistry = {
  "version": 1,
  "fields": {},
  "rows": {}
};

const exportArtifactManifest = {
  "baseName": "cerner-player-demo",
  "formFiles": [
    "cerner-player-demo/Identity.json",
    "cerner-player-demo/cerner-player-demo.jsx"
  ],
  "bindings": [],
  "localWriteTargets": [],
  "warnings": [],
  "moduleSemantics": {
    "navigationTargets": [],
    "persistedObservationTargets": [],
    "documentCommentTargets": [],
    "writeBindings": [],
    "measurementObservationWrites": [],
    "componentPayloadSource": "__componentPayloads",
    "activeDataRoot": "fd.field.data",
    "statusDataRoot": "fd.field.status"
  },
  "customComponents": [],
  "workflow": {
    "reports": [],
    "outputs": [],
    "actions": [],
    "runtimeHooks": [],
    "dialogs": [],
    "sourceLists": [],
    "suggestions": [],
    "relationships": []
  },
  "compatibilityIssues": []
};

const recordRuntimeAction = (fd, action, payload) => {
  if (!fd?.setFormData) return;
  fd.setFormData(
    produce((draft) => {
      draft.tempArea = draft.tempArea || {};
      const runtime = draft.tempArea.__moisRuntime || { lastAction: null, actionHistory: [] };
      const entry = { action, payload, timestamp: new Date().toISOString() };
      runtime.lastAction = entry;
      runtime.actionHistory = [...(runtime.actionHistory || []), entry].slice(-10);
      draft.tempArea.__moisRuntime = runtime;
    })
  );
};

const FormComponent = () => {
  const [fd] = useActiveData();
  const sd = useSourceData();
  const [isBuilderDataReady, setIsBuilderDataReady] = React.useState(false);
  if (fd) {
    if (!fd.field) fd.field = { data: {}, status: {} };
    if (fd.field && !fd.field.data) fd.field.data = {};
    if (fd.field && !fd.field.status) fd.field.status = {};
    if (!fd.formData) fd.formData = fd.field && fd.field.data || {};
    if (!fd.uiState) fd.uiState = { sections: {}, editing: false };
    if (fd.uiState && !fd.uiState.sections) fd.uiState.sections = {};
    if (typeof fd.setFormData === "function" && !fd.__builderSafeSetFormData) {
      const rawSetFormData = fd.setFormData;
      fd.setFormData = (update) => rawSetFormData((previous) => {
        const base = previous || {
          field: { data: {}, status: {}, history: [] },
          formData: {},
          uiState: { sections: {}, editing: false },
          tempArea: {},
        };
        if (typeof update !== "function") return update ?? base;
        const next = update(base);
        return next ?? base;
      });
      fd.__builderSafeSetFormData = true;
    }
  }
  const isComplete = fd?.uiState?.sections?.["0"]?.isComplete == true;
  const safeSectionComplete = (sectionSd, activeData, sectionNum) => {
    const sectionState = activeData?.uiState?.sections?.[sectionNum]?.isComplete;
    return sectionState ?? sectionSd?.webform?.isDraft === "N";
  };
  const observationMap = [];
  const documentCommentMap = [];
  const moisAutoFillMap = {};
  const isSigned = sd?.webform?.recordState === "SIGNED";
  const requiredSubmitFields = [{"id":"visit_date","label":"Visit date"},{"id":"reason","label":"Reason for visit"}];
  const isAuthorshipFieldLocked = (fieldId) => {
    const claims = fd?.field?.data?.__authorship?.claims || fd?.formData?.__authorship?.claims || {};
    const claim = claims["field:" + fieldId];
    if (!claim || claim.status === "unlocked" || claim.status === "pending") return false;
    const currentOwnerId = sd?.userProfile?.userProfileId ?? sd?.auth?.userProfileId;
    const currentOwnerName = sd?.userProfile?.identity?.fullName;
    const isOwner = claim.ownerId != null && currentOwnerId != null
      ? String(claim.ownerId) === String(currentOwnerId)
      : !!claim.ownerName && !!currentOwnerName && claim.ownerName === currentOwnerName;
    const editableUntil = claim.editableUntil || (claim.claimedAt || claim.timestamp ? new Date(new Date(claim.claimedAt || claim.timestamp).getTime() + 72 * 60 * 60 * 1000).toISOString() : null);
    const now = sd?.previewOptions?.authorshipNow ? new Date(sd.previewOptions.authorshipNow) : new Date();
    const expired = editableUntil ? now.getTime() > new Date(editableUntil).getTime() : false;
    return claim.status === "signed" || !isOwner || expired;
  };
  const getAuthorshipFieldClaim = (fieldId) => {
    const claims = fd?.field?.data?.__authorship?.claims || fd?.formData?.__authorship?.claims || {};
    return claims["field:" + fieldId] || null;
  };
  const formatAuthorshipTimestamp = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  };
  const formatAuthorshipFieldValue = (value) => {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.map(formatAuthorshipFieldValue).filter(Boolean).join(", ");
    if (typeof value === "object") return String(value.display ?? value.text ?? value.label ?? value.value ?? value.code ?? JSON.stringify(value));
    return String(value);
  };
  const AuthorshipReadOnlyField = ({ fieldId, label }) => {
    const data = fd?.field?.data || fd?.formData || {};
    const value = formatAuthorshipFieldValue(data[fieldId]);
    return (
      <div data-field-id={fieldId} style={{ display: "flex", alignItems: "flex-start", width: "100%", minHeight: "30px", padding: "5px 0" }}>
        {label ? <div style={{ flex: "0 0 240px", maxWidth: "240px", marginRight: "10px", fontWeight: 600 }}>{label}</div> : null}
        <div style={{ flex: "1 1 auto", minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value}</div>
      </div>
    );
  };
  const AuthorshipFieldStamp = ({ fieldId }) => {
    const claim = getAuthorshipFieldClaim(fieldId);
    if (!claim) return null;
    const owner = claim.ownerName || claim.ownerId || "Unknown";
    const currentOwnerId = sd?.userProfile?.userProfileId ?? sd?.auth?.userProfileId;
    const currentOwnerName = sd?.userProfile?.identity?.fullName;
    const isOwner = claim.ownerId != null && currentOwnerId != null
      ? String(claim.ownerId) === String(currentOwnerId)
      : !!claim.ownerName && !!currentOwnerName && claim.ownerName === currentOwnerName;
    const savedAt = formatAuthorshipTimestamp(claim.lastSavedAt || claim.timestamp || claim.claimedAt);
    const editableUntilRaw = claim.editableUntil || (claim.claimedAt || claim.timestamp ? new Date(new Date(claim.claimedAt || claim.timestamp).getTime() + 72 * 60 * 60 * 1000).toISOString() : null);
    const editableUntil = formatAuthorshipTimestamp(editableUntilRaw);
    const now = sd?.previewOptions?.authorshipNow ? new Date(sd.previewOptions.authorshipNow) : new Date();
    const expired = editableUntilRaw ? now.getTime() > new Date(editableUntilRaw).getTime() : false;
    const windowText = isOwner && editableUntil && !expired ? "Editable until " + editableUntil : "";
    const title = windowText || "Authorship stamp";
    return (
      <div title={title} style={{ flex: windowText ? "0 0 220px" : "0 0 auto", marginTop: "5px", color: "#605e5c", fontSize: "12px", lineHeight: "16px", whiteSpace: windowText ? "normal" : "nowrap" }}>
        {windowText ? (
          <>
            <div>Authored by {owner}</div>
            {savedAt ? <div>{savedAt}</div> : null}
            <div>{windowText}</div>
          </>
        ) : (
          <>Authored by {owner}{savedAt ? " - " + savedAt : ""}</>
        )}
      </div>
    );
  };
  const hasAuthorshipValue = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.some((entry) => hasAuthorshipValue(entry));
    if (typeof value === "object") return Object.values(value).some((entry) => hasAuthorshipValue(entry));
    return true;
  };
  const hasAuthorshipChange = (currentValue, sourceValue) => {
    const differs = JSON.stringify(currentValue ?? null) !== JSON.stringify(sourceValue ?? null);
    return differs && (hasAuthorshipValue(currentValue) || hasAuthorshipValue(sourceValue));
  };
  const buildGeneratedAuthorshipPersist = (action, activeState = fd) => {
    const baseData = { ...(activeState?.field?.data || {}) };
    const sourceData = sd?.sourceFormData && typeof sd.sourceFormData === "object" ? sd.sourceFormData : {};
    const store = { version: 1, claims: { ...((baseData.__authorship || {}).claims || {}) } };
    const ownerId = sd?.userProfile?.userProfileId ?? sd?.auth?.userProfileId;
    const ownerName = sd?.userProfile?.identity?.fullName || baseData.createdBy || sd?.webform?.provider?.name || "Unknown";
    const now = sd?.previewOptions?.authorshipNow ? new Date(sd.previewOptions.authorshipNow) : new Date();
    const nowIso = now.toISOString();
    let changed = false;
    Object.keys(store.claims || {}).forEach((claimKey) => {
      const claim = store.claims[claimKey];
      if (!claim || claim.status !== "pending") return;
      if (action === "save" && claim.lockOn !== "save") return;
      if (action === "submit" && claim.lockOn !== "save" && claim.lockOn !== "submit") return;
      const sameOwner = claim.ownerId != null && ownerId != null
        ? String(claim.ownerId) === String(ownerId)
        : !!claim.ownerName && claim.ownerName === ownerName;
      if (!sameOwner) return;
      const windowHours = typeof claim.editableWindowHours === "number" && claim.editableWindowHours > 0 ? claim.editableWindowHours : 72;
      store.claims[claimKey] = {
        ...claim,
        status: action === "sign" || claim.lockOn === "sign" ? "signed" : "locked",
        timestamp: nowIso,
        lastSavedAt: nowIso,
        claimedAt: nowIso,
        editableUntil: new Date(now.getTime() + windowHours * 60 * 60 * 1000).toISOString(),
      };
      changed = true;
    });
    Object.values((initialAuthorshipTargetRegistry || {}).fields || {}).forEach((target) => {
      const policy = target?.policy || {};
      if (!policy.enabled || policy.granularity === "row") return;
      if (action === "save" && policy.lockOn !== "save") return;
      if (action === "submit" && policy.lockOn !== "save" && policy.lockOn !== "submit") return;
      if (action === "sign" && policy.lockOn !== "save" && policy.lockOn !== "sign") return;
      const fieldId = target.fieldId;
      const relatedFieldIds = Array.isArray(target.relatedFieldIds) ? target.relatedFieldIds.filter(Boolean) : [];
      const currentValue = relatedFieldIds.length > 0
        ? Object.fromEntries(relatedFieldIds.filter((id) => hasAuthorshipValue(baseData[id])).map((id) => [id, baseData[id]]))
        : baseData[fieldId];
      const sourceValue = relatedFieldIds.length > 0
        ? Object.fromEntries(relatedFieldIds.map((id) => [id, sourceData[id]]))
        : sourceData[fieldId];
      const hasChange = hasAuthorshipChange(currentValue, sourceValue);
      const claimKey = "field:" + fieldId;
      const existing = store.claims[claimKey];
      if (!hasChange) {
        if (action === "sign" && existing && existing.lockOn === "save" && existing.status !== "unlocked" && existing.status !== "signed") {
          store.claims[claimKey] = { ...existing, status: "signed", timestamp: nowIso, lastSavedAt: nowIso, currentValue, sourceValue };
          changed = true;
        }
        return;
      }
      const editableUntil = existing?.editableUntil || (existing?.claimedAt || existing?.timestamp ? new Date(new Date(existing.claimedAt || existing.timestamp).getTime() + 72 * 60 * 60 * 1000).toISOString() : null);
      const expired = editableUntil ? now.getTime() > new Date(editableUntil).getTime() : false;
      const sameOwner = existing?.ownerId != null && ownerId != null ? String(existing.ownerId) === String(ownerId) : !!existing?.ownerName && existing.ownerName === ownerName;
      if (existing && existing.status !== "unlocked" && (existing.status === "signed" || expired || !sameOwner)) return;
      const windowHours = typeof policy.editableWindowHours === "number" && policy.editableWindowHours > 0 ? policy.editableWindowHours : 72;
      store.claims[claimKey] = {
        ...(existing || {}),
        claimKey,
        scope: "field",
        fieldId,
        ownerName,
        ownerId,
        timestamp: nowIso,
        claimedAt: existing?.claimedAt || nowIso,
        lastSavedAt: nowIso,
        editableUntil: existing?.editableUntil || new Date(now.getTime() + windowHours * 60 * 60 * 1000).toISOString(),
        status: action === "sign" || policy.lockOn === "sign" ? "signed" : "locked",
        lockOn: policy.lockOn || "save",
        currentValue,
        sourceValue,
      };
      changed = true;
    });
    if (!changed) return null;
    return { changed: true, formData: { ...baseData, __authorship: store }, store };
  };
  const buildPreparedPersist = (action, activeState = fd) => buildGeneratedAuthorshipPersist(action, activeState);

  const getMoisValidationDispatch = () => {
    const appSettings = typeof sd?.useAppSettings === "function" ? sd.useAppSettings() : null;
    return sd?.errorDispatch || appSettings?.errorDispatch || sd?.lifecycleDispatch || appSettings?.sessionDispatch || ((event) => console.warn("MOIS validation issue", event));
  };

  const reportMoisValidationErrors = (validator) => {
    const dispatch = getMoisValidationDispatch();
    if (typeof showValidationErrors === "function") {
      try {
        showValidationErrors(validator, dispatch);
        return;
      } catch (error) {
        console.warn("Unable to call showValidationErrors", error);
      }
    }
    const message = typeof validator?.errorsText === "function"
      ? "Validation errors: " + validator.errorsText(validator.errors, { dataVar: "Saved form data" })
      : "Validation errors: Saved form data did not match Schema.";
    dispatch({ type: "error", message, detailErrors: validator?.errors || [] });
  };

  const validateSubmitPayload = (payload) => {
    if (!Schema || typeof Ajv !== "function") return true;
    const validator = new Ajv({ allErrors: true, strictSchema: false });
    const isValid = validator.validate(Schema, payload?.formData || {});
    if (!isValid) {
      reportMoisValidationErrors(validator);
      return false;
    }
    return true;
  };

  useOnLoad((sd, fd) => {
    const baseData = Object.keys(sd.sourceFormData || {}).length > 0
      ? { ...sd.sourceFormData }
      : { ...(InitialData || {}) };
    fd.setFormData(
      produce((draft) => {
        if (!draft) {
          return {
            field: { data: applyMoisAutoFill(sd, baseData, moisAutoFillMap), status: {} },
            formData: applyMoisAutoFill(sd, baseData, moisAutoFillMap),
            uiState: {
              sections: {},
              editing: false,
              __authorshipTargets: {
                version: 1,
                fields: { ...(initialAuthorshipTargetRegistry.fields || {}) },
                rows: { ...(initialAuthorshipTargetRegistry.rows || {}) },
              },
            },
          };
        }
        draft.field = draft.field || { data: {}, status: {} };
        draft.uiState = draft.uiState || { sections: {}, editing: false };
        draft.uiState.sections = draft.uiState.sections || {};
        draft.uiState.__authorshipTargets = {
          version: 1,
          fields: {
            ...((draft.uiState.__authorshipTargets || {}).fields || {}),
            ...(initialAuthorshipTargetRegistry.fields || {})
          },
          rows: {
            ...((draft.uiState.__authorshipTargets || {}).rows || {}),
            ...(initialAuthorshipTargetRegistry.rows || {})
          }
        };
        draft.field.data = applyMoisAutoFill(sd, baseData, moisAutoFillMap);
      })
    );
    setIsBuilderDataReady(true);
  });

  const getSaveData = (prepared = buildPreparedPersist("save")) => ({
    formData: stripComponentPayloads(prepared?.formData || fd?.field?.data || {}),
    webformUpdate: null,
    documentUpdate: {
      author: sd.userProfile?.identity?.fullName,
      note: sd.formObject?.Identity?.title,
      comment: buildDocumentComment(fd, documentCommentMap) || undefined,
    }
  });

  const getSubmitData = (prepared = buildPreparedPersist("submit")) => {
    const componentPayload = collectComponentPayloads(fd);
    const workflowReports = buildWorkflowReports(fd);
    const workflowPayload = buildWorkflowUpdates(sd, fd, workflowReports);
    const mappedUpdates = observationMap.length ? buildDcoUpdates(sd, fd, observationMap) : [];
    const linkedDcos = [...mappedUpdates, ...(workflowPayload.DCOUpdates || []), ...(componentPayload.DCOUpdates || [])]
      .map(normalizeMoisObservationInput);
    const linkedPanels = [...(componentPayload.panels || []), ...buildWorkflowPanelUpdates(sd, fd)]
      .map(normalizeMoisObservationPanelInput);
    return ({
      formData: stripComponentPayloads(prepared?.formData || fd?.field?.data || {}),
      webformUpdate: componentPayload.webformUpdate,
      panels: linkedPanels.length ? linkedPanels : undefined,
      linkedPanels: linkedPanels.length ? linkedPanels : undefined,
      narratives: componentPayload.narratives,
      documentUpdate: {
        author: sd.userProfile?.identity?.fullName,
        note: sd.formObject?.Identity?.title,
        comment: buildDocumentComment(fd, documentCommentMap) || undefined,
      },
      DCOUpdates: linkedDcos
    });
  };

  const closeAfterMoisAction = () => {
    if (typeof window === "undefined") return;
    if (Array.isArray(window.__moisPreviewDiagnostics)) return;
    window.close();
  };

  const handleSaveClose = async () => {
    const prepared = buildPreparedPersist("save");
    const payload = getSaveData(prepared);
    recordRuntimeAction(fd, "saveDraft", payload);
    const success = await saveDraft(sd, fd, payload);
    if (typeof setChanges === "function") {
      setChanges(true);
    }
    if (success !== false && typeof commitPreparedAuthorshipPersist === "function") {
      commitPreparedAuthorshipPersist(fd, prepared);
    }
    if (success) {
      closeAfterMoisAction();
    }
  };

  const handleSubmitClose = async () => {
    const missingRequiredFields = requiredSubmitFields.filter(({ id }) => !hasMeaningfulValue(fd?.field?.data?.[id]));
    if (missingRequiredFields.length > 0) {
      const dispatch = getMoisValidationDispatch();
      dispatch({
        type: "error",
        message: "Cannot submit yet — please complete the required field" + (missingRequiredFields.length === 1 ? "" : "s") + ": " + missingRequiredFields.map(({ label }) => label).join(", "),
        detailErrors: missingRequiredFields.map(({ label }) => label + " is required"),
      });
      return;
    }
    const prepared = buildPreparedPersist("submit");
    const payload = getSubmitData(prepared);
    if (!validateSubmitPayload(payload)) return;
    recordRuntimeAction(fd, "signSubmit", payload);
    const success = await signSubmit("", sd, fd, payload);
    if (typeof setChanges === "function") {
      setChanges(true);
    }
    if (success !== false && typeof commitPreparedAuthorshipPersist === "function") {
      commitPreparedAuthorshipPersist(fd, prepared);
    }
    if (success) {
      closeAfterMoisAction();
    }
  };

  if (!isBuilderDataReady || !fd?.uiState?.sections) {
    return <div data-mois-form-loading="" />;
  }

  return (
    <Form maxWidth="950px">
      <style data-wf-form-design="">{"style[data-wf-form-design] ~ * [style*=\"break-inside\"] { margin-top: 8px !important; margin-bottom: 8px !important; } style[data-wf-form-design] ~ * [data-wf-question-spacing=\"compact\"] [style*=\"break-inside\"] { margin-top: 4px !important; margin-bottom: 4px !important; } style[data-wf-form-design] ~ * [data-wf-question-spacing=\"standard\"] [style*=\"break-inside\"] { margin-top: 8px !important; margin-bottom: 8px !important; } style[data-wf-form-design] ~ * [data-wf-question-spacing=\"comfortable\"] [style*=\"break-inside\"] { margin-top: 12px !important; margin-bottom: 12px !important; } style[data-wf-form-design] ~ * [data-wf-question-spacing=\"spacious\"] [style*=\"break-inside\"] { margin-top: 16px !important; margin-bottom: 16px !important; }"}</style>
      <style>{printStyles}</style>
      <Header marginBottom={"0px"}>
        <Title>{Identity.title}{sd?.webform?.isDraft === "N" ? null : " [DRAFT]"}</Title>
        <style>{"[data-builder-name-block] .ms-Stack[style*=\"border-width\"] { background: #a5cbee50 !important; border-bottom-color: #f3911f !important; }"}</style>
        <div data-builder-name-block>
          <NameBlock />
        </div>
      </Header>

        <Page pageId={0} label={"Page 1"}>
          <DateSelect fieldId='visit_date' label='Visit date' labelPosition='left' datePickerProps={{strings: { months: ["January","February","March","April","May","June","July","August","September","October","November","December"], shortMonths: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], days: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"], shortDays: ["S","M","T","W","T","F","S"], goToToday: "Go to today", prevMonthAriaLabel: "Go to previous month", nextMonthAriaLabel: "Go to next month", prevYearAriaLabel: "Go to previous year", nextYearAriaLabel: "Go to next year", closeButtonAriaLabel: "Close date picker", isRequiredErrorMessage: "A date is required", invalidInputErrorMessage: "Enter a valid date in YYYY.MM.DD format" }}} required readOnly={isComplete || isSigned} />
          <TextArea fieldId='reason' label='Reason for visit' labelPosition='left' required readOnly={isComplete || isSigned} />
          <TextArea fieldId='notes' label='Clinical notes' labelPosition='left' multiline rows={4} readOnly={isComplete || isSigned} />
          <TextArea fieldId='followup' label='Follow-up required' labelPosition='left' readOnly={isComplete || isSigned} />
        </Page>

      <Footer>
        <div className="hideonprint">
          <ButtonBar background="rgba(112, 170, 228, 0.4)">
            <PrintButton label={"Print"} />
            <SubmitButton onClick={handleSubmitClose} text={"Sign & Save"} reviseText="Edit" disabled={sd?.lifecycleState?.isMutating || isSigned} />
            <CloseButton text="Cancel" onClose={() => cancelForm(sd, fd)} />
          </ButtonBar>
        </div>
      </Footer>

    </Form>
  );
};