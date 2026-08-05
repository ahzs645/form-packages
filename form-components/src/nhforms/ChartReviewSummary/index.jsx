const { useMemo } = React
const { Stack, Label } = Fluent

// MOIS "Review of Most Recent Values" report colors.
const REVIEW_BLUE = "#004578"
const REVIEW_RED = "#a4262c"
const REVIEW_GRAY = "#8a8886"
const REVIEW_INK = "#201f1e"

// Shared text/date/code/flag helpers come from ObservationKit (referenced only
// inside function bodies — component sources load in no guaranteed order).

// Path walk that can return the patient *object*; ObservationKit.getPath is
// arrays-only so it does not cover this case.
const reviewGetObject = (sd, path) => {
  const steps = String(path ?? "").split(".").filter(Boolean)
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

const reviewAgeYears = (birthDate) => {
  const parsed = ObservationKit.parseDate(birthDate)
  if (!parsed) return null
  const now = new Date()
  let age = now.getFullYear() - parsed.getFullYear()
  const monthDelta = now.getMonth() - parsed.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < parsed.getDate())) age -= 1
  return age >= 0 ? age : null
}

// MOIS renders review dates as yyyy.mm.dd.
const reviewDateKey = (value) => ObservationKit.displayDate(ObservationKit.dateKey(value))

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
  const K = ObservationKit
  const patient = reviewGetObject(sd, sourcePath || "patient") ?? {}
  const codeList = useMemo(() => ObservationKit.normalizeCodes(codes), [codes])

  const age = reviewAgeYears(patient.birthDate ?? patient.dob)
  const sex = K.displayText(patient.administrativeGender ?? patient.gender).toUpperCase()

  const problems = useMemo(() => {
    const rows = reviewArray(patient.conditions)
      .filter((entry) => entry && typeof entry === "object")
      .filter((entry) => includeResolvedProblems || !ObservationKit.toText(entry.resolveDate).trim())
      .map((entry) => ({
        date: reviewDateKey(entry.startDate),
        time: ObservationKit.parseDate(entry.startDate)?.getTime() ?? 0,
        name: ObservationKit.displayText(entry.condition).toUpperCase(),
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
        const stopRaw = ObservationKit.toText(entry.endDate ?? entry.stopDate).trim()
        const stopTime = ObservationKit.parseDate(stopRaw)?.getTime() ?? null
        const doseText = ObservationKit.toText(entry.doseFrequency).trim() ||
          [
            ObservationKit.toText(entry.dose).trim(),
            ObservationKit.toText(entry.route).trim(),
            ObservationKit.toText(entry.frequency).trim(),
          ]
            .filter(Boolean)
            .join(" ")
        return {
          start: reviewDateKey(entry.startDate),
          startTime: ObservationKit.parseDate(entry.startDate)?.getTime() ?? 0,
          stop: reviewDateKey(stopRaw),
          stopped: stopTime !== null && stopTime < now,
          name:
            ObservationKit.displayText(entry.medication).toUpperCase() ||
            ObservationKit.displayText(entry.genericName).toUpperCase(),
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
        if (!ObservationKit.matchesCode(entry, candidate)) return
        const time = ObservationKit.parseDate(entry[datePath])?.getTime()
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
              const value = K.toText(latest.value ?? latest.display ?? latest.report).trim()
              const units = K.toText(latest.units).trim() || candidate.units
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
                  <span style={{ color: REVIEW_GRAY }}>{"  [ " + (K.classifyFlag(latest, value) || "N/A") + " ]"}</span>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </Stack>
  )
}
