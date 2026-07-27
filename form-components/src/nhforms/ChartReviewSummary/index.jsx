const { useMemo } = React
const { Stack, Label, Text } = Fluent

// MOIS "Review of Most Recent Values" report colors.
const REVIEW_BLUE = "#004578"
const REVIEW_RED = "#a4262c"
const REVIEW_GRAY = "#8a8886"
const REVIEW_INK = "#201f1e"

const reviewToText = (value) => {
  if (value === null || value === undefined) return ""
  return String(value)
}

const reviewParseDate = (value) => {
  const raw = reviewToText(value).trim()
  if (!raw) return null
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(/\./g, "-"))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// MOIS renders review dates as yyyy.mm.dd.
const reviewDateKey = (value) => {
  const raw = reviewToText(value)
  const datePart = raw.includes("T") ? raw.split("T")[0] : raw
  return datePart.replace(/-/g, ".")
}

const reviewGetPath = (sd, path) => {
  const steps = reviewToText(path).split(".").filter(Boolean)
  let current = sd
  for (const step of steps) {
    if (current && typeof current === "object") {
      current = current[step]
    } else {
      return undefined
    }
  }
  return current
}

const reviewArray = (value) => (Array.isArray(value) ? value : [])

// Display text for values that may be plain strings or {code, display} objects.
const reviewDisplay = (value) => {
  if (value && typeof value === "object") {
    return reviewToText(value.display ?? value.text ?? value.code).trim()
  }
  return reviewToText(value).trim()
}

const reviewAgeYears = (birthDate) => {
  const parsed = reviewParseDate(birthDate)
  if (!parsed) return null
  const now = new Date()
  let age = now.getFullYear() - parsed.getFullYear()
  const monthDelta = now.getMonth() - parsed.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < parsed.getDate())) age -= 1
  return age >= 0 ? age : null
}

const normalizeReviewCodes = (codes) => {
  if (!Array.isArray(codes)) return []
  return codes
    .map((entry) => {
      if (typeof entry === "string") {
        const code = entry.trim()
        return code ? { code, label: code, loincCode: "", units: "" } : null
      }
      if (!entry || typeof entry !== "object") return null
      const code = reviewToText(entry.code).trim()
      if (!code) return null
      return {
        code,
        label: reviewToText(entry.label).trim() || code,
        loincCode: reviewToText(entry.loincCode).trim(),
        units: reviewToText(entry.units).trim(),
      }
    })
    .filter(Boolean)
}

const reviewMatchesCode = (entry, candidate) => {
  const entryCode = reviewToText(entry?.observationCode).trim().toLowerCase()
  const entryLoinc = reviewToText(entry?.loincCode).trim().toLowerCase()
  const code = candidate.code.toLowerCase()
  const loinc = candidate.loincCode.toLowerCase()
  if (entryCode && (entryCode === code || (loinc && entryCode === loinc))) return true
  if (entryLoinc && (entryLoinc === code || (loinc && entryLoinc === loinc))) return true
  return false
}

const reviewNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// Explicit abnormal flag first, then the four MOIS bands from the record's own
// reference ranges — same precedence as ObservationQuery/ObservationEntryGrid.
const reviewFlagText = (entry, rawValue) => {
  const flag = entry?.abnormalFlag && typeof entry.abnormalFlag === "object"
    ? reviewToText(entry.abnormalFlag.code).trim()
    : reviewToText(entry?.abnormalFlag).trim()
  if (flag) return flag
  const value = reviewNumber(rawValue)
  if (value !== null) {
    const criticalLow = reviewNumber(entry?.rangeAbsurdLow) ?? reviewNumber(entry?.rangeVeryLow)
    const criticalHigh = reviewNumber(entry?.rangeAbsurdHigh) ?? reviewNumber(entry?.rangeVeryHigh)
    const normalLow = reviewNumber(entry?.rangeNormalLow)
    const normalHigh = reviewNumber(entry?.rangeNormalHigh)
    if (criticalLow !== null && value < criticalLow) return "LL"
    if (criticalHigh !== null && value > criticalHigh) return "HH"
    if (normalLow !== null && value < normalLow) return "L"
    if (normalHigh !== null && value > normalHigh) return "H"
  }
  return "N/A"
}

const reviewLineStyle = { whiteSpace: "pre-wrap", lineHeight: "17px" }
const reviewHeadingStyle = { ...reviewLineStyle, fontWeight: 700, color: REVIEW_INK, marginTop: 10 }

const ReviewSectionHeading = ({ children }) => <div style={reviewHeadingStyle}>{children}</div>

const ChartReviewSummary = ({
  title = "Review of Most Recent Values",
  showDemographics = true,
  showProblems = true,
  problemsTitle = "CURRENT PROBLEM LIST",
  includeResolvedProblems = false,
  showMedications = true,
  medicationsTitle = "CURRENT ACTIVE MEDICATIONS",
  observationsTitle = "DIABETES",
  codes = [],
  sourcePath = "patient",
  datePath = "collectedDateTime",
}) => {
  const sd = useSourceData()
  const patient = reviewGetPath(sd, sourcePath || "patient") ?? {}
  const codeList = useMemo(() => normalizeReviewCodes(codes), [codes])

  const age = reviewAgeYears(patient.birthDate ?? patient.dob)
  const sex = reviewDisplay(patient.administrativeGender ?? patient.gender).toUpperCase()

  const problems = useMemo(() => {
    const rows = reviewArray(patient.conditions)
      .filter((entry) => entry && typeof entry === "object")
      .filter((entry) => includeResolvedProblems || !reviewToText(entry.resolveDate).trim())
      .map((entry) => ({
        date: reviewDateKey(entry.startDate),
        time: reviewParseDate(entry.startDate)?.getTime() ?? 0,
        name: reviewDisplay(entry.condition).toUpperCase(),
      }))
      .filter((entry) => entry.name)
    rows.sort((left, right) => left.time - right.time)
    return rows
  }, [includeResolvedProblems, patient.conditions])

  const medications = useMemo(() => {
    const now = Date.now()
    const rows = reviewArray(patient.longTermMedications)
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const stopRaw = reviewToText(entry.endDate ?? entry.stopDate).trim()
        const stopTime = reviewParseDate(stopRaw)?.getTime() ?? null
        const doseText = reviewToText(entry.doseFrequency).trim() ||
          [reviewToText(entry.dose).trim(), reviewToText(entry.route).trim(), reviewToText(entry.frequency).trim()]
            .filter(Boolean)
            .join(" ")
        return {
          start: reviewDateKey(entry.startDate),
          startTime: reviewParseDate(entry.startDate)?.getTime() ?? 0,
          stop: reviewDateKey(stopRaw),
          stopped: stopTime !== null && stopTime < now,
          name: reviewDisplay(entry.medication).toUpperCase() || reviewDisplay(entry.genericName).toUpperCase(),
          dose: doseText,
        }
      })
      .filter((entry) => entry.name && !entry.stopped)
    rows.sort((left, right) => right.startTime - left.startTime)
    return rows
  }, [patient.longTermMedications])

  const latestByCode = useMemo(() => {
    const observations = reviewArray(patient.observations)
    return codeList.map((candidate) => {
      let best = null
      let bestTime = -Infinity
      observations.forEach((entry) => {
        if (!entry || typeof entry !== "object") return
        if (!reviewMatchesCode(entry, candidate)) return
        const time = reviewParseDate(entry[datePath])?.getTime()
        if (time === undefined || time === null) return
        if (time > bestTime) {
          best = entry
          bestTime = time
        }
      })
      return { candidate, latest: best }
    })
  }, [codeList, datePath, patient.observations])

  return (
    <Stack tokens={{ childrenGap: 4 }}>
      {title ? <Label>{title}</Label> : null}
      <div
        style={{
          border: "1px solid #d0d0d0",
          background: "#ffffff",
          padding: "10px 14px",
          fontFamily: '"Consolas", "Menlo", "Courier New", monospace',
          fontSize: 12,
          color: REVIEW_INK,
        }}
      >
        {showDemographics ? (
          <div style={{ ...reviewLineStyle, fontWeight: 700 }}>
            {"Age = " + (age === null ? "-" : age) + "    SEX = " + (sex || "-")}
          </div>
        ) : null}

        {showProblems ? (
          <div>
            <ReviewSectionHeading>{problemsTitle}</ReviewSectionHeading>
            {problems.length === 0 ? (
              <div style={{ ...reviewLineStyle, color: REVIEW_GRAY }}> None recorded</div>
            ) : (
              problems.map((problem, index) => (
                <div key={index} style={{ ...reviewLineStyle, color: REVIEW_BLUE }}>
                  {" " + (problem.date || "          ").padEnd(11)} {problem.name}
                </div>
              ))
            )}
          </div>
        ) : null}

        {showMedications ? (
          <div>
            <ReviewSectionHeading>{medicationsTitle}</ReviewSectionHeading>
            <div style={{ ...reviewLineStyle, color: REVIEW_BLUE, fontWeight: 700 }}>
              {" START DATE  STOP DATE"}
            </div>
            {medications.length === 0 ? (
              <div style={{ ...reviewLineStyle, color: REVIEW_GRAY }}> None recorded</div>
            ) : (
              medications.map((medication, index) => (
                <div key={index} style={reviewLineStyle}>
                  <span style={{ color: REVIEW_BLUE }}>
                    {" " + (medication.start || "").padEnd(12) + (medication.stop || "").padEnd(12)}
                  </span>
                  <span style={{ color: REVIEW_BLUE }}>{medication.name}</span>
                  {medication.dose ? <span style={{ color: REVIEW_GRAY }}>{" [ " + medication.dose + " ]"}</span> : null}
                </div>
              ))
            )}
          </div>
        ) : null}

        {codeList.length > 0 ? (
          <div>
            <ReviewSectionHeading>{observationsTitle}</ReviewSectionHeading>
            {latestByCode.map(({ candidate, latest }, index) => {
              if (!latest) {
                return (
                  <div key={index} style={{ ...reviewLineStyle, color: REVIEW_RED }}>
                    {" " + candidate.label + " Not Found"}
                  </div>
                )
              }
              const value = reviewToText(latest.value ?? latest.display ?? latest.report).trim()
              const units = reviewToText(latest.units).trim() || candidate.units
              // Date-only records (vaccines, assessments) render as "LABEL - date",
              // matching how MOIS lists them without a value or flag bracket.
              if (!value) {
                return (
                  <div key={index} style={{ ...reviewLineStyle, color: REVIEW_BLUE }}>
                    {" " + candidate.label + " - " + reviewDateKey(latest[datePath])}
                  </div>
                )
              }
              return (
                <div key={index} style={reviewLineStyle}>
                  <span style={{ color: REVIEW_BLUE }}>
                    {" " + candidate.label + " - " + reviewDateKey(latest[datePath]) + " - "}
                  </span>
                  <span style={{ color: REVIEW_BLUE, fontWeight: 700 }}>
                    {value + (units ? " " + units : "")}
                  </span>
                  <span style={{ color: REVIEW_GRAY }}>{"  [ " + reviewFlagText(latest, value) + " ]"}</span>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </Stack>
  )
}
