const { useMemo, useState } = React
const {
  Stack,
  Text,
  DefaultButton,
  PrimaryButton,
  Dialog,
  DialogType,
  Icon,
  Separator,
} = Fluent

const DEFAULT_HEALTH_MAINTENANCE_RULES = {
  general: [
    {
      title: 'Lifestyle / Behavioral',
      items: [
        {
          id: 'physical_activity',
          title: 'Physical activity',
          kind: 'path',
          sourcePaths: [
            'patient.lifestyle.physicalActivity',
            'patient.preventiveCare.physicalActivity',
            'field.physicalActivity',
          ],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
        },
        {
          id: 'alcohol_intake',
          title: 'Alcohol intake',
          kind: 'path',
          sourcePaths: [
            'patient.lifestyle.alcoholIntake',
            'patient.preventiveCare.alcoholIntake',
            'field.alcoholIntake',
          ],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
        },
        {
          id: 'smoking_status',
          title: 'Smoking status',
          kind: 'path',
          sourcePaths: [
            'patient.lifestyle.smokingStatus',
            'patient.smokingStatus',
            'field.smokingStatus',
          ],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
        },
        {
          id: 'cannabis_use',
          title: 'Cannabis use',
          kind: 'path',
          sourcePaths: [
            'patient.lifestyle.cannabisUse',
            'patient.preventiveCare.cannabisUse',
            'field.cannabisUse',
          ],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
        },
      ],
    },
    {
      title: 'Vitals',
      items: [
        {
          id: 'weight',
          title: 'Weight',
          kind: 'observation',
          observationCodes: ['WEIGHT', '3141-9'],
          observationDescriptionIncludes: ['weight'],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
          referenceRange: '0 to 150',
          sparkline: true,
        },
        {
          id: 'waist_circumference',
          title: 'Waist circumference',
          kind: 'observation',
          observationCodes: ['WAIST'],
          observationDescriptionIncludes: ['waist circumference'],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
          referenceRange: '65 to 110 cm',
          sparkline: true,
        },
        {
          id: 'body_mass_index',
          title: 'Body mass index',
          kind: 'observation',
          observationCodes: ['BMI', '39156-5'],
          observationDescriptionIncludes: ['body mass index', 'bmi'],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
          referenceRange: '18.5 to 25',
          sparkline: true,
        },
        {
          id: 'blood_pressure',
          title: 'Blood pressure',
          kind: 'observation',
          observationCodes: ['BP', 'BLOOD_PRESSURE'],
          observationDescriptionIncludes: ['blood pressure', 'systolic/diastolic'],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
          referenceRange: 'N/A',
          sparkline: true,
        },
      ],
    },
    {
      title: 'Lab Work',
      items: [
        {
          id: 'screening_cholesterol',
          title: 'Screening cholesterol',
          kind: 'observation',
          observationCodes: ['CHOL', '2093-3'],
          observationDescriptionIncludes: ['screening cholesterol', 'cholesterol'],
          frequencyDays: 1825,
          frequencyLabel: 'Every 5 years',
          referenceRange: '0 to 5.2 mmol/L',
          sparkline: true,
        },
        {
          id: 'screening_chol_hdl_ratio',
          title: 'Screening chol / HDL ratio',
          kind: 'observation',
          observationCodes: ['CHOL_HDL_RATIO'],
          observationDescriptionIncludes: ['chol/hdl', 'cholesterol / hdl ratio'],
          frequencyDays: 1825,
          frequencyLabel: 'Every 5 years',
          referenceRange: '0 to 5',
          sparkline: true,
        },
        {
          id: 'gfr',
          title: 'GFR',
          kind: 'observation',
          observationCodes: ['GFR', '33914-3'],
          observationDescriptionIncludes: ['gfr', 'serpl-vrate'],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
          referenceRange: '60 to 500',
          sparkline: true,
        },
      ],
    },
    {
      title: 'Vaccines',
      items: [
        {
          id: 'tetanus_vaccine',
          title: 'Tetanus vaccine',
          kind: 'path',
          sourcePaths: [
            'patient.immunizations.tetanus',
            'patient.preventiveCare.tetanus',
            'field.tetanusVaccine',
          ],
          frequencyDays: 3650,
          frequencyLabel: 'Every 10 years',
        },
      ],
    },
    {
      title: 'Screenings',
      items: [
        {
          id: 'framingham_risk',
          title: 'Framingham cardiac risk assessment',
          kind: 'path',
          sourcePaths: [
            'patient.preventiveCare.framinghamRisk',
            'patient.cardiacRisk.framingham',
            'field.framinghamRisk',
          ],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
        },
        {
          id: 'hiv_screening',
          title: 'HIV screening',
          kind: 'observation',
          observationCodes: ['HIV', 'HIV_SCREEN'],
          observationDescriptionIncludes: ['hiv screening', 'hiv 1', 'hiv 1/2'],
          frequencyDays: 3650,
          frequencyLabel: 'At least once / repeat by risk',
        },
      ],
    },
  ],
  conditionSpecific: [
    {
      id: 'diabetes',
      title: 'Diabetes management',
      matchConditions: {
        codes: ['DM1', 'DM2', 'T1DM', 'T2DM'],
        text: ['diabetes'],
      },
      items: [
        {
          id: 'hba1c',
          title: 'HbA1c',
          section: 'Glycemic control',
          kind: 'observation',
          observationCodes: ['HBA1C', '4548-4', '17856-6'],
          observationDescriptionIncludes: ['hba1c', 'hemoglobin a1c'],
          frequencyDays: 180,
          frequencyLabel: 'Every 6 months',
          referenceRange: '0 to 7 %',
          sparkline: true,
        },
        {
          id: 'retinopathy_screening',
          title: 'Retinopathy screening',
          section: 'Eye care',
          kind: 'path',
          sourcePaths: [
            'patient.preventiveCare.diabetesRetinopathy',
            'patient.diabetes.retinopathyScreening',
            'field.diabetesRetinopathy',
          ],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
        },
        {
          id: 'foot_exam',
          title: 'Foot exam',
          section: 'Foot care',
          kind: 'path',
          sourcePaths: [
            'patient.preventiveCare.diabetesFootExam',
            'patient.diabetes.footExam',
            'field.diabetesFootExam',
          ],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
        },
        {
          id: 'urine_acr',
          title: 'Urine albumin / creatinine ratio',
          section: 'Renal monitoring',
          kind: 'observation',
          observationCodes: ['ACR', '14959-1'],
          observationDescriptionIncludes: ['albumin / creatinine', 'acr', 'microalbumin'],
          frequencyDays: 365,
          frequencyLabel: 'Every 12 months',
          referenceRange: '0 to 2.8 mg/mmol',
          sparkline: true,
        },
      ],
    },
    {
      id: 'heart_failure',
      title: 'Heart failure management',
      matchConditions: {
        codes: ['CHF', 'HF'],
        text: ['heart failure', 'congestive heart failure'],
      },
      items: [
        {
          id: 'ejection_fraction',
          title: 'Ejection fraction',
          section: 'Cardiac function',
          kind: 'observation',
          observationCodes: ['2455', 'EF'],
          observationDescriptionIncludes: ['ejection fraction'],
          frequencyDays: 730,
          frequencyLabel: 'Every 24 months',
          referenceRange: '40 to 70 %',
          sparkline: true,
        },
        {
          id: 'renal_monitoring',
          title: 'Renal function monitoring',
          section: 'Medication safety',
          kind: 'observation',
          observationCodes: ['GFR', '33914-3', 'CREATININE'],
          observationDescriptionIncludes: ['gfr', 'creatinine'],
          frequencyDays: 180,
          frequencyLabel: 'Every 6 months',
          sparkline: true,
        },
        {
          id: 'diuretic_monitoring',
          title: 'Diuretic monitoring',
          section: 'Medication safety',
          kind: 'path',
          sourcePaths: [
            'patient.heartFailure.diureticMonitoring',
            'patient.preventiveCare.diureticMonitoring',
            'field.diureticMonitoring',
          ],
          frequencyDays: 180,
          frequencyLabel: 'Every 6 months',
        },
      ],
    },
  ],
}

const STATUS_META = {
  overdue: {
    label: 'Overdue',
    icon: 'Warning',
    tone: '#b91c1c',
    background: '#fee2e2',
    border: '#fecaca',
  },
  not_found: {
    label: 'Not found',
    icon: 'StatusCircleRing',
    tone: '#9f1239',
    background: '#fce7f3',
    border: '#fbcfe8',
  },
  upcoming: {
    label: 'Upcoming',
    icon: 'Clock',
    tone: '#92400e',
    background: '#fef3c7',
    border: '#fde68a',
  },
  completed: {
    label: 'Completed',
    icon: 'Completed',
    tone: '#166534',
    background: '#dcfce7',
    border: '#bbf7d0',
  },
}

const STATUS_ORDER = {
  overdue: 0,
  not_found: 1,
  upcoming: 2,
  completed: 3,
}

const normalizeString = (value, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`
  }
  return fallback
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  if (isObject(value)) return Object.keys(value).length > 0
  return true
}

const toPathSegments = (path) =>
  String(path || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)

const resolvePathValue = (root, path) => {
  if (!root || !path) return undefined
  const segments = toPathSegments(path)
  if (segments.length === 0) return undefined

  let current = root
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (/^\d+$/.test(segment)) {
        current = current[Number(segment)]
      } else {
        current = current
          .map((entry) => (entry != null ? entry[segment] : undefined))
          .filter((entry) => entry !== undefined && entry !== null)
      }
      if (current === undefined || current === null) return current
      continue
    }

    if (isObject(current)) {
      current = current[segment]
      if (current === undefined || current === null) return current
      continue
    }

    return undefined
  }

  return current
}

const flattenValues = (value) => {
  if (!Array.isArray(value)) return value === undefined || value === null ? [] : [value]
  const flattened = []
  value.forEach((entry) => {
    if (Array.isArray(entry)) {
      flattened.push(...flattenValues(entry))
      return
    }
    if (entry !== undefined && entry !== null) {
      flattened.push(entry)
    }
  })
  return flattened
}

const readScopedPathValue = (path, sourceRoot, activeRoot) => {
  const normalizedPath = normalizeString(path)
  if (!normalizedPath) return undefined

  if (normalizedPath.startsWith('field.')) {
    return resolvePathValue(activeRoot, normalizedPath.slice('field.'.length))
  }
  if (normalizedPath.startsWith('active.')) {
    return resolvePathValue(activeRoot, normalizedPath.slice('active.'.length))
  }
  if (normalizedPath.startsWith('source.')) {
    return resolvePathValue(sourceRoot, normalizedPath.slice('source.'.length))
  }
  if (normalizedPath.startsWith('sd.')) {
    return resolvePathValue(sourceRoot, normalizedPath.slice('sd.'.length))
  }

  const fromSource = resolvePathValue(sourceRoot, normalizedPath)
  if (isMeaningfulValue(fromSource)) return fromSource

  return resolvePathValue(activeRoot, normalizedPath)
}

const normalizeDate = (value) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const raw = normalizeString(value)
  if (!raw) return null

  const normalized = /^\d{4}[./-]\d{2}[./-]\d{2}$/.test(raw)
    ? raw.replace(/\./g, '-')
    : raw
  const direct = new Date(normalized)
  if (!Number.isNaN(direct.getTime())) return direct

  if (raw.includes('T')) {
    const dateOnly = new Date(raw.split('T')[0])
    if (!Number.isNaN(dateOnly.getTime())) return dateOnly
  }

  return null
}

const formatDate = (value) => {
  const date = value instanceof Date ? value : normalizeDate(value)
  if (!date) return normalizeString(value, '-')
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}.${month}.${day}`
}

const addDays = (date, days) => {
  if (!(date instanceof Date) || !Number.isFinite(days)) return null
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + Math.trunc(days))
  return next
}

const daysBetween = (fromDate, toDate) => {
  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) return null
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

const computeAge = (birthDate, asOfDate) => {
  const dob = normalizeDate(birthDate)
  const asOf = normalizeDate(asOfDate)
  if (!dob || !asOf) return null

  let age = asOf.getFullYear() - dob.getFullYear()
  const monthDelta = asOf.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getDate() < dob.getDate())) {
    age -= 1
  }
  return age
}

const stringifyValue = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return `${value}`
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyValue(entry)).filter(Boolean).join(', ')
  }
  if (isObject(value)) {
    const candidateKeys = [
      'text',
      'display',
      'value',
      'label',
      'description',
      'status',
      'result',
      'code',
      'name',
    ]
    for (const key of candidateKeys) {
      const candidate = stringifyValue(value[key])
      if (candidate) return candidate
    }
    if (Array.isArray(value.selectedLabels) && value.selectedLabels.length > 0) {
      return value.selectedLabels.map((entry) => stringifyValue(entry)).filter(Boolean).join(', ')
    }
  }
  return ''
}

const parseNumericValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = stringifyValue(value)
  if (!text) return null
  const normalized = text
    .replace(/[−–—]/g, '-')
    .replace(/(\d)[,\s](?=\d{3}\b)/g, '$1')
    .replace(/,(?=\d{1,2}\b)/g, '.')
  const match = normalized.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

const dedupeStrings = (values) => {
  const seen = {}
  const out = []
  flattenValues(values).forEach((entry) => {
    const normalized = normalizeString(entry)
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen[key]) return
    seen[key] = true
    out.push(normalized)
  })
  return out
}

const normalizePatientName = (patient) => {
  if (!patient || !isObject(patient)) return 'Unknown patient'
  const direct = stringifyValue(patient.name?.text || patient.fullName || patient.name)
  if (direct) return direct
  const first = stringifyValue(patient.name?.first || patient.firstName)
  const middle = stringifyValue(patient.name?.middle || patient.middleName)
  const family = stringifyValue(patient.name?.family || patient.lastName || patient.familyName)
  return [first, middle, family].filter(Boolean).join(' ') || 'Unknown patient'
}

const normalizeGenderValue = (value) => {
  const text = stringifyValue(value).toLowerCase()
  if (!text) return ''
  if (text === 'm' || text === 'male') return 'male'
  if (text === 'f' || text === 'female') return 'female'
  return text
}

const toDisplayGender = (patient) => {
  const fromAdmin = stringifyValue(patient?.administrativeGender?.display || patient?.administrativeGender?.code)
  const fromGender = stringifyValue(patient?.gender)
  const normalized = normalizeGenderValue(fromAdmin || fromGender)
  if (!normalized) return 'Unknown'
  if (normalized === 'male') return 'Male'
  if (normalized === 'female') return 'Female'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const normalizeConditionRecord = (entry, asOfDate) => {
  if (!entry || typeof entry !== 'object') return null
  const code = normalizeString(entry.condition?.code || entry.code)
  const display = normalizeString(entry.condition?.display || entry.display || entry.description || entry.name || entry.text)
  const resolveDate = normalizeDate(entry.resolveDate || entry.endDate || entry.stopDate)
  const asOf = normalizeDate(asOfDate)
  const isActive = !resolveDate || !asOf || resolveDate.getTime() > asOf.getTime()

  if (!code && !display) return null

  return {
    code,
    display: display || code,
    isActive,
  }
}

const normalizeObservationRecord = (entry) => {
  if (!entry || typeof entry !== 'object') return null
  const description = normalizeString(entry.description || entry.label || entry.name)
  const code = normalizeString(entry.observationCode || entry.code || entry.loincCode)
  const valueText = stringifyValue(
    entry.value ??
      entry.result ??
      entry.resultValue ??
      entry.observationValue ??
      entry.codedValue?.display ??
      entry.codedValue?.code
  )
  const unitsText = normalizeString(entry.units || entry.unit)
  const collectedDate = normalizeDate(
    entry.collectedDateTime ||
      entry.reportedDateTime ||
      entry.reportedDate ||
      entry.date ||
      entry.observedAt ||
      entry.when
  )

  if (!description && !code && !valueText) return null

  return {
    code,
    description,
    valueText,
    unitsText,
    date: collectedDate,
    sortTime: collectedDate ? collectedDate.getTime() : 0,
    numericValue: parseNumericValue(valueText),
  }
}

const collectConditionRecords = (sourceRoot, paths, asOfDate) => {
  const collected = []
  flattenValues(paths).forEach((path) => {
    const value = readScopedPathValue(path, sourceRoot, {})
    flattenValues(value).forEach((entry) => {
      const normalized = normalizeConditionRecord(entry, asOfDate)
      if (normalized && normalized.isActive) {
        collected.push(normalized)
      }
    })
  })

  const deduped = []
  const seen = {}
  collected.forEach((entry) => {
    const key = `${entry.code}__${entry.display}`.toLowerCase()
    if (seen[key]) return
    seen[key] = true
    deduped.push(entry)
  })
  return deduped
}

const collectObservationRecords = (sourceRoot, paths) => {
  const collected = []

  const appendRecord = (entry) => {
    if (!entry) return
    if (Array.isArray(entry)) {
      entry.forEach((child) => appendRecord(child))
      return
    }
    if (isObject(entry) && Array.isArray(entry.observations)) {
      entry.observations.forEach((child) => appendRecord(child))
      return
    }
    const normalized = normalizeObservationRecord(entry)
    if (normalized) {
      collected.push(normalized)
    }
  }

  flattenValues(paths).forEach((path) => {
    const value = readScopedPathValue(path, sourceRoot, {})
    appendRecord(value)
  })

  return collected.sort((left, right) => right.sortTime - left.sortTime)
}

const coercePositiveInt = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.max(1, Math.floor(numeric))
}

const toArrayOfRecords = (value) => {
  if (!isMeaningfulValue(value)) return []
  if (Array.isArray(value)) return value
  if (isObject(value) && Array.isArray(value.records)) return value.records
  if (isObject(value) && Array.isArray(value.history)) return value.history
  return [value]
}

const normalizePathRecord = (entry, fallbackDatePaths, sourceRoot, activeRoot) => {
  if (!isMeaningfulValue(entry)) return null
  if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
    return {
      valueText: stringifyValue(entry),
      date: null,
      sortTime: 0,
      unitsText: '',
      numericValue: parseNumericValue(entry),
    }
  }

  if (!isObject(entry)) return null

  let explicitDate = null
  dedupeStrings(fallbackDatePaths).forEach((path) => {
    if (explicitDate) return
    const fromEntry = resolvePathValue(entry, path)
    if (isMeaningfulValue(fromEntry)) {
      explicitDate = normalizeDate(fromEntry)
      return
    }
    const scoped = readScopedPathValue(path, sourceRoot, activeRoot)
    if (isMeaningfulValue(scoped)) {
      explicitDate = normalizeDate(scoped)
    }
  })

  const valueText = stringifyValue(
    entry.value ??
      entry.display ??
      entry.text ??
      entry.label ??
      entry.status ??
      entry.result ??
      entry.code ??
      entry.name ??
      (entry.ischecked === true ? 'Yes' : entry.ischecked === false ? 'No' : '')
  )

  const date =
    explicitDate ||
    normalizeDate(entry.date || entry.when || entry.collectedDateTime || entry.updatedAt || entry.completedDate)

  return {
    valueText,
    date,
    sortTime: date ? date.getTime() : 0,
    unitsText: normalizeString(entry.units || entry.unit),
    numericValue: parseNumericValue(valueText),
  }
}

const normalizeRuleItem = (item, fallbackSection = '', fallbackGroupTitle = '') => {
  if (!item || typeof item !== 'object') return null
  const match = isObject(item.match) ? item.match : {}
  const appliesTo = isObject(item.appliesTo) ? item.appliesTo : {}
  const frequencyDays = Number(item.frequencyDays ?? item.intervalDays)
  const normalizedFrequencyDays = Number.isFinite(frequencyDays) && frequencyDays > 0 ? Math.floor(frequencyDays) : null

  return {
    id: normalizeString(item.id || item.key || item.title || item.label),
    title: normalizeString(item.title || item.label || item.id, 'Review item'),
    section: normalizeString(item.section || item.category || fallbackSection, 'General'),
    groupTitle: normalizeString(item.groupTitle || fallbackGroupTitle),
    kind: normalizeString(item.kind, ''),
    sourcePaths: dedupeStrings(item.sourcePaths || item.paths || match.sourcePaths),
    datePaths: dedupeStrings(item.datePaths || match.datePaths),
    observationCodes: dedupeStrings(item.observationCodes || match.observationCodes || match.codes),
    observationDescriptionIncludes: dedupeStrings(
      item.observationDescriptionIncludes ||
        item.descriptionIncludes ||
        item.observationDescriptions ||
        match.observationDescriptionIncludes ||
        match.descriptionIncludes ||
        match.observationDescriptions
    ),
    minAge: Number.isFinite(Number(item.minAge ?? appliesTo.minAge))
      ? Number(item.minAge ?? appliesTo.minAge)
      : null,
    maxAge: Number.isFinite(Number(item.maxAge ?? appliesTo.maxAge))
      ? Number(item.maxAge ?? appliesTo.maxAge)
      : null,
    sex: normalizeString(item.sex || appliesTo.sex).toLowerCase(),
    conditionCodes: dedupeStrings(item.conditionCodes || appliesTo.conditionCodes),
    conditionText: dedupeStrings(item.conditionText || appliesTo.conditionText),
    frequencyDays: normalizedFrequencyDays,
    frequencyLabel: normalizeString(item.frequencyLabel || item.intervalLabel),
    referenceRange: normalizeString(item.referenceRange || item.range),
    sparkline: item.sparkline !== false,
  }
}

const flattenRuleEntries = (input, fallbackSection = '', fallbackGroupTitle = '') => {
  if (!input) return []
  if (Array.isArray(input)) {
    return input
      .map((entry) => {
        if (isObject(entry) && Array.isArray(entry.items)) {
          return flattenRuleEntries(entry.items, normalizeString(entry.title || entry.section || fallbackSection), fallbackGroupTitle)
        }
        return normalizeRuleItem(entry, fallbackSection, fallbackGroupTitle)
      })
      .flat()
      .filter(Boolean)
  }

  if (isObject(input) && Array.isArray(input.items)) {
    return flattenRuleEntries(input.items, normalizeString(input.title || input.section || fallbackSection), fallbackGroupTitle)
  }

  const normalized = normalizeRuleItem(input, fallbackSection, fallbackGroupTitle)
  return normalized ? [normalized] : []
}

const normalizeRuleSet = (rules, rulesJson) => {
  let parsedRules = rules

  if (!parsedRules && typeof rulesJson === 'string' && rulesJson.trim()) {
    try {
      parsedRules = JSON.parse(rulesJson)
    } catch (_error) {
      parsedRules = null
    }
  }

  const ruleSource = parsedRules && typeof parsedRules === 'object' ? parsedRules : DEFAULT_HEALTH_MAINTENANCE_RULES
  const generalSource = Array.isArray(ruleSource)
    ? ruleSource
    : ruleSource.general || ruleSource.items || ruleSource.sections
  const general = flattenRuleEntries(generalSource, '', '')
  const rawConditionGroups = Array.isArray(ruleSource.conditionSpecific || ruleSource.conditionGroups)
    ? ruleSource.conditionSpecific || ruleSource.conditionGroups
    : []

  const conditionSpecific = rawConditionGroups
    .map((group, index) => {
      if (!group || typeof group !== 'object') return null
      return {
        id: normalizeString(group.id || group.title, `condition_group_${index + 1}`),
        title: normalizeString(group.title || group.name, `Condition group ${index + 1}`),
        matchCodes: dedupeStrings(group.matchConditions?.codes || group.conditionCodes),
        matchText: dedupeStrings(group.matchConditions?.text || group.conditionText),
        items: flattenRuleEntries(group.items || [], '', normalizeString(group.title || group.name)),
      }
    })
    .filter(Boolean)

  return {
    general: general.length > 0 ? general : flattenRuleEntries(DEFAULT_HEALTH_MAINTENANCE_RULES.general, '', ''),
    conditionSpecific,
  }
}

const matchesConditionFilters = (conditions, codes, textTerms) => {
  const normalizedCodes = dedupeStrings(codes).map((entry) => entry.toLowerCase())
  const normalizedText = dedupeStrings(textTerms).map((entry) => entry.toLowerCase())
  if (normalizedCodes.length === 0 && normalizedText.length === 0) return true

  return conditions.some((condition) => {
    const code = normalizeString(condition.code).toLowerCase()
    const display = normalizeString(condition.display).toLowerCase()
    const codeMatch = normalizedCodes.length > 0 && normalizedCodes.includes(code)
    const textMatch =
      normalizedText.length > 0 &&
      normalizedText.some((term) => display.includes(term) || code.includes(term))
    return codeMatch || textMatch
  })
}

const isRuleApplicable = (rule, context) => {
  if (!rule) return false
  if (Number.isFinite(rule.minAge) && Number.isFinite(context.age) && context.age < rule.minAge) return false
  if (Number.isFinite(rule.maxAge) && Number.isFinite(context.age) && context.age > rule.maxAge) return false
  if (rule.sex) {
    const patientSex = normalizeGenderValue(context.gender)
    if (patientSex && patientSex !== normalizeGenderValue(rule.sex)) return false
  }
  if (!matchesConditionFilters(context.conditions, rule.conditionCodes, rule.conditionText)) return false
  return true
}

const findObservationHistory = (rule, observations) => {
  const codes = rule.observationCodes.map((entry) => entry.toLowerCase())
  const descriptions = rule.observationDescriptionIncludes.map((entry) => entry.toLowerCase())
  return observations.filter((observation) => {
    const code = normalizeString(observation.code).toLowerCase()
    const description = normalizeString(observation.description).toLowerCase()
    const codeMatch = codes.length > 0 && codes.includes(code)
    const descriptionMatch =
      descriptions.length > 0 &&
      descriptions.some((term) => description.includes(term) || code.includes(term))
    if (codes.length === 0 && descriptions.length === 0) return false
    return codeMatch || descriptionMatch
  })
}

const findPathHistory = (rule, sourceRoot, activeRoot) => {
  const history = []

  rule.sourcePaths.forEach((path) => {
    const resolved = readScopedPathValue(path, sourceRoot, activeRoot)
    if (!isMeaningfulValue(resolved)) return
    toArrayOfRecords(resolved).forEach((entry) => {
      const normalized = normalizePathRecord(entry, rule.datePaths, sourceRoot, activeRoot)
      if (normalized && isMeaningfulValue(normalized.valueText)) {
        history.push(normalized)
      }
    })
  })

  return history.sort((left, right) => right.sortTime - left.sortTime)
}

const formatFrequencyLabel = (rule) => {
  if (rule.frequencyLabel) return rule.frequencyLabel
  if (!Number.isFinite(rule.frequencyDays)) return ''
  if (rule.frequencyDays % 3650 === 0) {
    const years = Math.round(rule.frequencyDays / 365)
    return `Every ${years} years`
  }
  if (rule.frequencyDays % 365 === 0) {
    const years = Math.round(rule.frequencyDays / 365)
    return years === 1 ? 'Every 12 months' : `Every ${years} years`
  }
  if (rule.frequencyDays % 30 === 0) {
    const months = Math.round(rule.frequencyDays / 30)
    return months === 1 ? 'Every month' : `Every ${months} months`
  }
  return `Every ${rule.frequencyDays} days`
}

const formatValueLabel = (record) => {
  if (!record) return 'No matching record'
  const base = normalizeString(record.valueText, 'Recorded')
  if (!record.unitsText) return base
  if (base.toLowerCase().includes(record.unitsText.toLowerCase())) return base
  return `${base} ${record.unitsText}`
}

const buildDueText = (status, dueDate, asOfDate) => {
  if (status === 'not_found') return 'No matching record found'
  if (!dueDate) return 'Date available but no interval configured'

  const delta = daysBetween(asOfDate, dueDate)
  if (!Number.isFinite(delta)) return `Due ${formatDate(dueDate)}`
  if (status === 'completed') return `Next due ${formatDate(dueDate)}`
  if (status === 'upcoming') {
    if (delta === 0) return `Due today (${formatDate(dueDate)})`
    return `Due ${formatDate(dueDate)} (in ${delta} days)`
  }
  return `Due ${formatDate(dueDate)} (${Math.abs(delta)} days overdue)`
}

const buildReviewItem = (rule, context, sourceRoot, activeRoot, upcomingWindowDays) => {
  const observationHistory = findObservationHistory(rule, context.observations)
  const pathHistory = findPathHistory(rule, sourceRoot, activeRoot)
  const history = observationHistory.length > 0 ? observationHistory : pathHistory
  const latest = history[0] || null
  const frequencyDays = rule.frequencyDays
  const dueDate = latest && Number.isFinite(frequencyDays) && latest.date ? addDays(latest.date, frequencyDays) : null

  let status = 'not_found'
  if (latest) {
    status = 'completed'
    if (dueDate) {
      const delta = daysBetween(context.asOfDate, dueDate)
      if (Number.isFinite(delta) && delta < 0) {
        status = 'overdue'
      } else if (Number.isFinite(delta) && delta <= upcomingWindowDays) {
        status = 'upcoming'
      }
    }
  }

  const trendHistory = history
    .filter((entry) => Number.isFinite(entry.numericValue))
    .slice(0, 5)
    .reverse()
  const trendPoints = trendHistory.map((entry) => Number(entry.numericValue))

  return {
    id: rule.id,
    title: rule.title,
    section: rule.section,
    groupTitle: rule.groupTitle,
    status,
    latestValue: formatValueLabel(latest),
    latestDate: latest?.date ? formatDate(latest.date) : '-',
    dueDate,
    dueText: buildDueText(status, dueDate, context.asOfDate),
    frequencyLabel: formatFrequencyLabel(rule),
    referenceRange: rule.referenceRange,
    trendPoints: rule.sparkline && trendPoints.length >= 2 ? trendPoints : [],
    isConditionSpecific: Boolean(rule.groupTitle),
  }
}

const groupItemsBySection = (items) => {
  const buckets = {}
  items.forEach((item) => {
    const key = normalizeString(item.section, 'General')
    if (!buckets[key]) {
      buckets[key] = []
    }
    buckets[key].push(item)
  })

  return Object.entries(buckets)
    .map(([title, sectionItems]) => ({
      title,
      items: sectionItems
        .slice()
        .sort((left, right) => {
          const statusDelta = STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
          if (statusDelta !== 0) return statusDelta
          return left.title.localeCompare(right.title)
        }),
    }))
    .sort((left, right) => left.title.localeCompare(right.title))
}

const mergeSourceData = (sourceData, sourceOverride) => {
  if (!sourceOverride || typeof sourceOverride !== 'object') return sourceData || {}
  const base = sourceData && typeof sourceData === 'object' ? sourceData : {}
  const override = sourceOverride
  const merged = {
    ...base,
    ...override,
  }

  if (isObject(base.patient) || isObject(override.patient)) {
    merged.patient = {
      ...(isObject(base.patient) ? base.patient : {}),
      ...(isObject(override.patient) ? override.patient : {}),
    }
  }

  if (isObject(base.webform) || isObject(override.webform)) {
    merged.webform = {
      ...(isObject(base.webform) ? base.webform : {}),
      ...(isObject(override.webform) ? override.webform : {}),
      encounter: {
        ...(isObject(base.webform?.encounter) ? base.webform.encounter : {}),
        ...(isObject(override.webform?.encounter) ? override.webform.encounter : {}),
      },
    }
  }

  if (isObject(base.queryResult) || isObject(override.queryResult)) {
    merged.queryResult = {
      ...(isObject(base.queryResult) ? base.queryResult : {}),
      ...(isObject(override.queryResult) ? override.queryResult : {}),
    }
  }

  return merged
}

const buildSparklinePath = (points, width, height, padding) => {
  if (!Array.isArray(points) || points.length < 2) return ''
  const values = points.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
  if (values.length < 2) return ''

  const min = Math.min(...values)
  const max = Math.max(...values)
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const range = max - min || 1

  return values
    .map((value, index) => {
      const x = padding + (usableWidth * index) / Math.max(values.length - 1, 1)
      const normalizedY = (value - min) / range
      const y = height - padding - usableHeight * normalizedY
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`
    })
    .join(' ')
}

const Sparkline = ({ points }) => {
  const path = buildSparklinePath(points, 92, 28, 3)
  if (!path) return null
  const delta = points[points.length - 1] - points[points.length - 2]
  const stroke = delta > 0 ? '#0f766e' : delta < 0 ? '#b91c1c' : '#475569'

  return (
    <svg width='92' height='28' viewBox='0 0 92 28' aria-hidden='true'>
      <path
        d={path}
        fill='none'
        stroke={stroke}
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.completed
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.background,
        color: meta.tone,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <Icon iconName={meta.icon} styles={{ root: { fontSize: 12, color: meta.tone } }} />
      {meta.label}
    </span>
  )
}

const SummaryCard = ({ label, value, tone }) => (
  <div
    style={{
      minWidth: 140,
      flex: '1 1 140px',
      borderRadius: 14,
      border: '1px solid #e2e8f0',
      background: '#ffffff',
      padding: 14,
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    }}
  >
    <Text
      variant='small'
      styles={{ root: { display: 'block', color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.6 } }}
    >
      {label}
    </Text>
    <Text
      variant='xLarge'
      styles={{ root: { display: 'block', marginTop: 4, color: tone || '#0f172a', fontWeight: 700 } }}
    >
      {value}
    </Text>
  </div>
)

const renderHeaderField = (label, value) => (
  <div style={{ minWidth: 112 }}>
    <Text
      variant='small'
      styles={{ root: { display: 'block', color: '#64748b', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.7 } }}
    >
      {label}
    </Text>
    <Text styles={{ root: { display: 'block', marginTop: 2, color: '#0f172a', fontWeight: 600 } }}>
      {value || '-'}
    </Text>
  </div>
)

const ItemCard = ({ item }) => (
  <div
    key={item.id}
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr) auto',
      gap: 14,
      alignItems: 'center',
      padding: 14,
      borderRadius: 14,
      border: '1px solid #e2e8f0',
      background: '#ffffff',
    }}
  >
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Text styles={{ root: { color: '#0f172a', fontWeight: 700 } }}>{item.title}</Text>
        {item.isConditionSpecific ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: 999,
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {item.groupTitle}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {item.frequencyLabel ? (
          <Text variant='small' styles={{ root: { color: '#475569' } }}>
            {item.frequencyLabel}
          </Text>
        ) : null}
        {item.referenceRange ? (
          <Text variant='small' styles={{ root: { color: '#475569' } }}>
            Range: {item.referenceRange}
          </Text>
        ) : null}
        <Text variant='small' styles={{ root: { color: '#475569' } }}>
          {item.dueText}
        </Text>
      </div>
    </div>
    <div style={{ minWidth: 0 }}>
      <Text
        styles={{
          root: {
            display: 'block',
            color: item.status === 'not_found' ? '#9f1239' : '#0f172a',
            fontWeight: 700,
            wordBreak: 'break-word',
          },
        }}
      >
        {item.latestValue}
      </Text>
      <Text variant='small' styles={{ root: { display: 'block', marginTop: 4, color: '#64748b' } }}>
        Latest: {item.latestDate}
      </Text>
    </div>
    <div style={{ display: 'grid', justifyItems: 'end', gap: 8 }}>
      <StatusBadge status={item.status} />
      {item.trendPoints.length >= 2 ? <Sparkline points={item.trendPoints} /> : null}
    </div>
  </div>
)

const HealthMaintenanceReview = ({
  id,
  fieldId = 'healthMaintenanceReview',
  label = 'Health Maintenance Review',
  buttonText = 'Health Maintenance Review',
  modalTitle = 'Health Maintenance Review',
  modalSubtitle = 'Preventive care snapshot',
  reviewDate,
  reviewDatePath = '',
  rules,
  rulesJson = '',
  sourceOverride,
  patientSourcePaths = ['patient', 'queryResult.patient.0', 'queryResult.patient[0]'],
  conditionSourcePaths = [
    'patient.conditions',
    'queryResult.patient.0.conditions',
    'queryResult.patient[0].conditions',
    'webform.encounter.healthIssues',
  ],
  observationSourcePaths = [
    'patient.observations',
    'queryResult.patient.0.observations',
    'queryResult.patient[0].observations',
    'observations',
  ],
  healthNumberPaths = [
    'patient.bcHealthNo',
    'patient.healthNumber',
    'patient.phn',
    'patient.healthCardNumber',
  ],
  aliasPaths = ['patient.alias', 'patient.aliasName'],
  chartNumberPaths = [
    'patient.chartNumber',
    'webform.encounter.chartNumber',
    'queryResult.patient.0.chartNumber',
    'queryResult.patient[0].chartNumber',
  ],
  upcomingWindowDays = 30,
  showTriggerSummary = true,
  showPrintButton = true,
  defaultOpen = false,
}) => {
  const sd = useSourceData()
  const [fd] = useActiveData()
  const [isOpen, setIsOpen] = useState(defaultOpen === true)

  const activeRoot = fd?.field?.data || {}
  const effectiveSource = useMemo(() => mergeSourceData(sd, sourceOverride), [sd, sourceOverride])
  const resolvedFieldId = normalizeString(fieldId || id, 'healthMaintenanceReview')
  const effectiveRules = useMemo(() => normalizeRuleSet(rules, rulesJson), [rules, rulesJson])

  const review = useMemo(() => {
    const patientCandidates = dedupeStrings(patientSourcePaths)
      .map((path) => readScopedPathValue(path, effectiveSource, activeRoot))
      .filter((entry) => isObject(entry))
    const patient = patientCandidates[0] || effectiveSource.patient || {}

    const resolvedReviewDate =
      normalizeDate(reviewDate) ||
      normalizeDate(reviewDatePath ? readScopedPathValue(reviewDatePath, effectiveSource, activeRoot) : null) ||
      new Date()

    const conditions = collectConditionRecords(effectiveSource, conditionSourcePaths, resolvedReviewDate)
    const observations = collectObservationRecords(effectiveSource, observationSourcePaths)
    const age = computeAge(patient.birthDate || patient.dob, resolvedReviewDate)
    const gender = toDisplayGender(patient)

    const context = {
      patient,
      asOfDate: resolvedReviewDate,
      age,
      gender,
      conditions,
      observations,
    }

    const generalItems = effectiveRules.general
      .filter((rule) => isRuleApplicable(rule, context))
      .map((rule) => buildReviewItem(rule, context, effectiveSource, activeRoot, coercePositiveInt(upcomingWindowDays, 30)))

    const matchedConditionGroups = effectiveRules.conditionSpecific
      .filter((group) => matchesConditionFilters(conditions, group.matchCodes, group.matchText))
      .map((group) => ({
        id: group.id,
        title: group.title,
        sections: groupItemsBySection(
          group.items
            .filter((rule) => isRuleApplicable(rule, context))
            .map((rule) => buildReviewItem(rule, context, effectiveSource, activeRoot, coercePositiveInt(upcomingWindowDays, 30)))
        ),
      }))
      .filter((group) => group.sections.length > 0)

    const allItems = [
      ...generalItems,
      ...matchedConditionGroups.flatMap((group) => group.sections.flatMap((section) => section.items)),
    ]

    const summary = allItems.reduce(
      (acc, item) => {
        acc.total += 1
        acc[item.status] += 1
        return acc
      },
      { total: 0, completed: 0, upcoming: 0, overdue: 0, not_found: 0 }
    )

    const healthNumber = dedupeStrings(healthNumberPaths)
      .map((path) => stringifyValue(readScopedPathValue(path, effectiveSource, activeRoot)))
      .find(Boolean)
    const alias = dedupeStrings(aliasPaths)
      .map((path) => stringifyValue(readScopedPathValue(path, effectiveSource, activeRoot)))
      .find(Boolean)
    const chartNumber = dedupeStrings(chartNumberPaths)
      .map((path) => stringifyValue(readScopedPathValue(path, effectiveSource, activeRoot)))
      .find(Boolean)

    return {
      patientName: normalizePatientName(patient),
      dob: formatDate(patient.birthDate || patient.dob),
      gender,
      chartNumber,
      healthNumber,
      alias,
      age,
      asOfDate: resolvedReviewDate,
      conditions,
      summary,
      generalSections: groupItemsBySection(generalItems),
      matchedConditionGroups,
    }
  }, [
    activeRoot,
    aliasPaths,
    chartNumberPaths,
    conditionSourcePaths,
    effectiveRules,
    effectiveSource,
    healthNumberPaths,
    observationSourcePaths,
    patientSourcePaths,
    reviewDate,
    reviewDatePath,
    upcomingWindowDays,
  ])

  const triggerSummaryText = useMemo(() => {
    const parts = []
    if (review.summary.overdue > 0) parts.push(`${review.summary.overdue} overdue`)
    if (review.summary.not_found > 0) parts.push(`${review.summary.not_found} missing`)
    if (review.summary.upcoming > 0) parts.push(`${review.summary.upcoming} upcoming`)
    if (parts.length === 0 && review.summary.completed > 0) {
      parts.push(`${review.summary.completed} complete`)
    }
    return parts.join('  |  ')
  }, [review.summary])

  return (
    <div id={resolvedFieldId} data-field-id={resolvedFieldId}>
      <Stack tokens={{ childrenGap: 6 }}>
        <DefaultButton
          text={buttonText || label}
          onClick={() => setIsOpen(true)}
          styles={{
            root: {
              borderRadius: 12,
              borderColor: '#cbd5e1',
              minHeight: 40,
              paddingLeft: 12,
              paddingRight: 12,
            },
            label: { color: '#0f172a', fontWeight: 600 },
          }}
        />
        {showTriggerSummary && triggerSummaryText ? (
          <Text variant='small' styles={{ root: { color: '#64748b' } }}>
            {triggerSummaryText}
          </Text>
        ) : null}
      </Stack>

      <Dialog
        hidden={!isOpen}
        onDismiss={() => setIsOpen(false)}
        dialogContentProps={{
          type: DialogType.largeHeader,
          title: modalTitle,
          subText: `${modalSubtitle}  |  As of ${formatDate(review.asOfDate)}  |  Read only`,
        }}
        modalProps={{
          isBlocking: false,
          styles: {
            main: {
              width: '96vw',
              maxWidth: 1180,
            },
          },
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 16,
            maxHeight: '72vh',
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: 14,
              borderRadius: 18,
              border: '1px solid #dbeafe',
              background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 58%, #ffffff 100%)',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ minWidth: 260, flex: '1 1 320px' }}>
                <Text variant='xLarge' styles={{ root: { display: 'block', color: '#0f172a', fontWeight: 700 } }}>
                  {review.patientName}
                </Text>
                <Text styles={{ root: { display: 'block', marginTop: 4, color: '#475569' } }}>
                  Age {Number.isFinite(review.age) ? review.age : '-'}  |  {review.gender}
                </Text>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {renderHeaderField('DOB', review.dob)}
                {renderHeaderField('Chart', review.chartNumber)}
                {renderHeaderField('BC Health No.', review.healthNumber)}
                {renderHeaderField('Alias', review.alias)}
              </div>
            </div>

            {review.conditions.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {review.conditions.map((condition) => (
                  <span
                    key={`${condition.code}_${condition.display}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: '#ffffff',
                      border: '1px solid #bfdbfe',
                      color: '#1e3a8a',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Icon iconName='Health' styles={{ root: { fontSize: 12, color: '#2563eb' } }} />
                    {condition.display}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <SummaryCard label='Completed' value={review.summary.completed} tone='#166534' />
            <SummaryCard label='Upcoming' value={review.summary.upcoming} tone='#92400e' />
            <SummaryCard label='Overdue' value={review.summary.overdue} tone='#b91c1c' />
            <SummaryCard label='Not Found' value={review.summary.not_found} tone='#9f1239' />
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                borderRadius: 18,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text variant='large' styles={{ root: { color: '#0f172a', fontWeight: 700 } }}>
                  General screening
                </Text>
                <Text variant='small' styles={{ root: { color: '#64748b' } }}>
                  {review.generalSections.reduce((count, section) => count + section.items.length, 0)} items
                </Text>
              </div>

              <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                {review.generalSections.map((section) => (
                  <div key={section.title} style={{ display: 'grid', gap: 10 }}>
                    <Separator>
                      <Text variant='small' styles={{ root: { color: '#334155', fontWeight: 700 } }}>
                        {section.title}
                      </Text>
                    </Separator>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {section.items.map((item) => (
                        <ItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {review.matchedConditionGroups.map((group) => (
              <div
                key={group.id}
                style={{
                  borderRadius: 18,
                  border: '1px solid #dbeafe',
                  background: '#ffffff',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <Text variant='large' styles={{ root: { color: '#0f172a', fontWeight: 700 } }}>
                      {group.title}
                    </Text>
                    <Text variant='small' styles={{ root: { display: 'block', marginTop: 4, color: '#64748b' } }}>
                      Condition-triggered review items
                    </Text>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {group.sections.reduce((count, section) => count + section.items.length, 0)} items
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                  {group.sections.map((section) => (
                    <div key={`${group.id}_${section.title}`} style={{ display: 'grid', gap: 10 }}>
                      <Separator>
                        <Text variant='small' styles={{ root: { color: '#334155', fontWeight: 700 } }}>
                          {section.title}
                        </Text>
                      </Separator>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {section.items.map((item) => (
                          <ItemCard key={`${group.id}_${item.id}`} item={item} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {review.generalSections.length === 0 && review.matchedConditionGroups.length === 0 ? (
              <div
                style={{
                  borderRadius: 16,
                  border: '1px dashed #cbd5e1',
                  background: '#f8fafc',
                  padding: 18,
                }}
              >
                <Text styles={{ root: { color: '#0f172a', fontWeight: 700 } }}>No review items available</Text>
                <Text variant='small' styles={{ root: { display: 'block', marginTop: 6, color: '#64748b' } }}>
                  Check the patient context paths and rules configuration for this component.
                </Text>
              </div>
            ) : null}
          </div>
        </div>

        <Stack horizontal horizontalAlign='space-between' tokens={{ childrenGap: 8 }} style={{ marginTop: 18 }}>
          <div>
            <Text variant='small' styles={{ root: { color: '#64748b' } }}>
              Read-only decision support snapshot. No chart data is changed from this view.
            </Text>
          </div>
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            {showPrintButton ? (
              <DefaultButton
                text='Print'
                onClick={() => {
                  if (typeof window !== 'undefined' && typeof window.print === 'function') {
                    window.print()
                  }
                }}
              />
            ) : null}
            <PrimaryButton text='Close' onClick={() => setIsOpen(false)} />
          </Stack>
        </Stack>
      </Dialog>
    </div>
  )
}
