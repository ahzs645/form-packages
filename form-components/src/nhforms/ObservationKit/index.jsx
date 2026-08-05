// ObservationKit — shared runtime kernel for the observation-family NHForms
// components (ObservationQuery, ObservationEntryGrid, FlowSheet,
// HistoricalObservationTable). Non-rendering helper module in the
// FormSessionRuntime pattern: it exports a single namespace object so
// consumers keep one bare identifier in engine scope.
//
// Consumers must reference ObservationKit only inside function bodies —
// component files load in no guaranteed order, so a top-level read of another
// module's export can run before that module has been evaluated.
//
// Real chart observations carry ISO "YYYY-MM-DDTHH:mm:ss" dates (verified
// against the SMOIS sandbox saved-form DB and mois-import-patient.json);
// parseDate additionally accepts "."- or "/"-separated day-precision dates
// that authors feed through custom sourcePaths.

const ObservationKit = (() => {
  const toText = (value) => {
    if (value === null || value === undefined) return ""
    return String(value)
  }

  // Display text for values that may be plain strings or {code, display}
  // coded objects.
  const displayText = (value) => {
    if (value && typeof value === "object") {
      return toText(value.display ?? value.text ?? value.code).trim()
    }
    return toText(value).trim()
  }

  // Code text for coded values: prefer the code over the human display.
  const codeText = (value) => {
    if (value && typeof value === "object") {
      return toText(value.code ?? value.display).trim()
    }
    return toText(value).trim()
  }

  const dateKey = (value) => {
    const raw = toText(value)
    return raw.includes("T") ? raw.split("T")[0] : raw
  }

  const parseDate = (value) => {
    const raw = toText(value).trim()
    if (!raw) return null
    const parsed = new Date(raw.includes("T") ? raw : raw.replace(/[./]/g, "-"))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // Day-precision timestamp so date-range comparisons ignore time of day.
  const dayTime = (value) => {
    const parsed = parseDate(dateKey(value))
    return parsed ? parsed.getTime() : null
  }

  // MOIS renders dates with dot separators (2024.11.21).
  const displayDate = (key) => toText(key).replace(/-/g, ".")

  const getPath = (sd, path, fallback = "patient.observations") => {
    const steps = toText(path || fallback).split(".").filter(Boolean)
    let current = sd
    for (const step of steps) {
      if (current && typeof current === "object") {
        current = current[step]
      } else {
        return []
      }
    }
    return Array.isArray(current) ? current : []
  }

  const normalizeCodes = (codes) => {
    if (!Array.isArray(codes)) return []
    return codes
      .map((entry) => {
        if (typeof entry === "string") {
          const code = entry.trim()
          return code ? { code, label: code, loincCode: "", units: "", hotkey: "" } : null
        }
        if (!entry || typeof entry !== "object") return null
        const code = toText(entry.code).trim()
        if (!code) return null
        return {
          code,
          label: toText(entry.label).trim() || code,
          loincCode: toText(entry.loincCode).trim(),
          units: toText(entry.units).trim(),
          hotkey: toText(entry.hotkey).trim().slice(0, 1).toLowerCase(),
        }
      })
      .filter(Boolean)
  }

  // Cutoff for a {amount, unit} lookback window, anchored at "now". Returns
  // null when the window is unset or invalid so callers fall back to full
  // history.
  const cutoffDate = (lookback) => {
    if (!lookback || typeof lookback !== "object") return null
    const amount = Math.floor(Number(lookback.amount))
    if (!Number.isFinite(amount) || amount <= 0) return null
    const cutoff = new Date()
    if (lookback.unit === "days") {
      cutoff.setDate(cutoff.getDate() - amount)
    } else if (lookback.unit === "years") {
      cutoff.setFullYear(cutoff.getFullYear() - amount)
    } else if (lookback.unit === "months") {
      cutoff.setMonth(cutoff.getMonth() - amount)
    } else {
      return null
    }
    return cutoff
  }

  const lookbackLabel = (lookback) => {
    const amount = Math.floor(Number(lookback?.amount))
    if (!Number.isFinite(amount) || amount <= 0) return ""
    const unit = lookback.unit === "days" || lookback.unit === "months" || lookback.unit === "years" ? lookback.unit : null
    if (!unit) return ""
    const singular = { days: "day", months: "month", years: "year" }[unit]
    return "Last " + amount + " " + (amount === 1 ? singular : unit)
  }

  // A chart entry matches a configured {code, loincCode} candidate when either
  // of the entry's identifiers equals either of the candidate's,
  // case-insensitively.
  const matchesCode = (entry, candidate) => {
    const entryCode = toText(entry?.observationCode).trim().toLowerCase()
    const entryLoinc = toText(entry?.loincCode).trim().toLowerCase()
    const code = toText(candidate?.code).trim().toLowerCase()
    const loinc = toText(candidate?.loincCode).trim().toLowerCase()
    if (entryCode && (entryCode === code || (loinc && entryCode === loinc))) return true
    if (entryLoinc && (entryLoinc === code || (loinc && entryLoinc === loinc))) return true
    return false
  }

  const matchCodeIndex = (entry, codeList) => {
    for (let index = 0; index < codeList.length; index += 1) {
      if (matchesCode(entry, codeList[index])) return index
    }
    return -1
  }

  const toNumber = (value) => {
    const text = toText(value).trim()
    if (!text) return null
    const parsed = Number(text)
    return Number.isFinite(parsed) ? parsed : null
  }

  const extractValue = (entry) => toText(entry?.value ?? entry?.display ?? entry?.report ?? "")

  // Four MOIS abnormal bands: critical LL/HH (absurd/very ranges) outrank L/H
  // (normal range) — mirrors the PastMeasurementField save-path
  // classification. Returns "" when the value is non-numeric, no ranges are
  // present, or the value sits inside the normal range.
  const classifyRanges = (ranges, rawValue) => {
    const value = toNumber(rawValue)
    if (value === null || !ranges || typeof ranges !== "object") return ""
    const criticalLow = toNumber(ranges.rangeAbsurdLow) ?? toNumber(ranges.rangeVeryLow)
    const criticalHigh = toNumber(ranges.rangeAbsurdHigh) ?? toNumber(ranges.rangeVeryHigh)
    const normalLow = toNumber(ranges.rangeNormalLow)
    const normalHigh = toNumber(ranges.rangeNormalHigh)
    if (criticalLow !== null && value < criticalLow) return "LL"
    if (criticalHigh !== null && value > criticalHigh) return "HH"
    if (normalLow !== null && value < normalLow) return "L"
    if (normalHigh !== null && value > normalHigh) return "H"
    return ""
  }

  // Entry-level classification: an explicit chart abnormalFlag wins, then the
  // entry's own range metadata.
  const classifyFlag = (entry, rawValue) => {
    const explicit =
      entry?.abnormalFlag && typeof entry.abnormalFlag === "object"
        ? toText(entry.abnormalFlag.code).trim()
        : toText(entry?.abnormalFlag).trim()
    if (explicit) return explicit
    return classifyRanges(entry, rawValue)
  }

  const flagCellStyle = (flag) => {
    if (flag === "LL" || flag === "HH") {
      return { background: "#fde7e9", color: "#a4262c", fontWeight: 600 }
    }
    if (flag === "L" || flag === "H") {
      return { background: "#fff4ce" }
    }
    return {}
  }

  return {
    toText,
    displayText,
    codeText,
    dateKey,
    parseDate,
    dayTime,
    displayDate,
    getPath,
    normalizeCodes,
    cutoffDate,
    lookbackLabel,
    matchesCode,
    matchCodeIndex,
    toNumber,
    extractValue,
    classifyRanges,
    classifyFlag,
    flagCellStyle,
  }
})()
