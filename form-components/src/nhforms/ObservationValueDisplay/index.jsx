const { useMemo } = React
const { Stack, Label, Text, Link } = Fluent

// ObservationValueDisplay — read-only inline display of a patient's prior
// observation value ("2026.07.01  128 mmol/L"). This is the builder-native
// replacement for the legacy dform `^viewonly=measure;CODE;value;recent^`
// control: the twin that sat beside a writable `^fid=` entry field and only
// ever showed the last charted result.
//
// STRUCTURAL CONTRACT — this component never writes.
// It takes no field id, reads only through useSourceData (never the active-form
// data or save hooks), and has no persistence setting at all. "Display a past
// result" and "capture a new result" are therefore different components, not
// two modes of one component.
// PastMeasurementField remains the *entry* control (it owns the input, the
// observation write, and the history strip beside it); a form that only wants
// the read uses this component and can no longer land in the two failure modes
// the shared component allowed — an entry field that shows history but silently
// never persists, and a read-only field that writes stale history back.
//
// Matching, date parsing, and abnormal-band classification all delegate to the
// shared ObservationKit kernel, so this component sees the same case-insensitive
// code/LOINC comparison and the same LL/HH/L/H flags as ObservationQuery,
// FlowSheet, and ObservationEntryGrid. ObservationKit is referenced only inside
// function bodies — bundled component files load in no guaranteed order.

// Most recent matching observations, newest first. Returns [] when no code is
// configured so the caller can render a builder hint instead of "not found".
const collectObservationValues = (sd, {
  sourcePath,
  datePath,
  observationCode,
  loincCode,
  observationComment,
  lookback,
  maxRows,
  units,
}) => {
  const candidate = {
    code: ObservationKit.toText(observationCode).trim(),
    loincCode: ObservationKit.toText(loincCode).trim(),
  }
  if (!candidate.code && !candidate.loincCode) return []

  const cutoff = ObservationKit.cutoffDate(lookback)
  const commentFilter = ObservationKit.toText(observationComment).trim().toLowerCase()
  const rows = []

  ObservationKit.getPath(sd, sourcePath).forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return
    if (!ObservationKit.matchesCode(entry, candidate)) return
    const parsedDate = ObservationKit.parseDate(entry[datePath])
    if (!parsedDate) return
    if (cutoff && parsedDate.getTime() < cutoff.getTime()) return
    // Legacy measurement pairs disambiguate same-code rows by comment
    // (PastMeasurementField's observationComment filter does the same).
    if (commentFilter && ObservationKit.toText(entry.comment).trim().toLowerCase() !== commentFilter) return
    const value = ObservationKit.extractValue(entry).trim()
    if (!value) return
    rows.push({
      index,
      time: parsedDate.getTime(),
      dateText: ObservationKit.displayDate(ObservationKit.dateKey(entry[datePath])),
      value,
      units: ObservationKit.toText(entry.units).trim() || ObservationKit.toText(units).trim(),
      flag: ObservationKit.classifyFlag(entry, value),
    })
  })

  const limit = Math.max(1, Math.floor(Number(maxRows)) || 1)
  return rows
    .sort((left, right) => right.time - left.time || left.index - right.index)
    .slice(0, limit)
}

const ObservationValueDisplay = ({
  id,
  label = "",
  // "left" places the label beside the value (the legacy viewonly layout);
  // "top" stacks it; "none" renders the value alone.
  labelPosition = "left",
  observationCode = "",
  loincCode = "",
  observationComment = "",
  sourcePath = "patient.observations",
  datePath = "collectedDateTime",
  lookback = null,
  maxRows = 1,
  showDate = true,
  showUnits = true,
  showAbnormalFlag = true,
  units = "",
  emptyText = "No past measurement available",
  graphLinkText = "",
  graphHref = "",
}) => {
  const sd = useSourceData()

  const items = useMemo(
    () => collectObservationValues(sd, {
      sourcePath,
      datePath,
      observationCode,
      loincCode,
      observationComment,
      lookback,
      maxRows,
      units,
    }),
    [datePath, loincCode, lookback, maxRows, observationCode, observationComment, sd, sourcePath, units]
  )

  const hasCode = Boolean(
    ObservationKit.toText(observationCode).trim() || ObservationKit.toText(loincCode).trim()
  )
  const inline = labelPosition !== "top"
  const showLabel = Boolean(label) && labelPosition !== "none"
  const windowLabel = ObservationKit.lookbackLabel(lookback)

  let body = null
  if (!hasCode) {
    body = <Text variant="small">No observation code configured for this display.</Text>
  } else if (items.length === 0) {
    body = <Text variant="small">{emptyText}</Text>
  } else {
    body = (
      <Stack tokens={{ childrenGap: 2 }}>
        {items.map((item) => (
          <Stack
            key={`${item.time}-${item.index}`}
            horizontal
            verticalAlign="center"
            tokens={{ childrenGap: 6 }}
            styles={{ root: { flexWrap: "wrap" } }}
          >
            {showDate ? (
              <Text variant="small" styles={{ root: { color: "#605e5c", whiteSpace: "nowrap" } }}>
                {item.dateText}
              </Text>
            ) : null}
            <Text
              variant="small"
              styles={{
                root: {
                  fontWeight: 600,
                  padding: "0 3px",
                  ...(showAbnormalFlag ? ObservationKit.flagCellStyle(item.flag) : {}),
                },
              }}
            >
              {item.value}
              {showUnits && item.units ? ` ${item.units}` : ""}
              {showAbnormalFlag && item.flag ? <span style={{ marginLeft: 6, fontWeight: 700 }}>{item.flag}</span> : null}
            </Text>
          </Stack>
        ))}
      </Stack>
    )
  }

  return (
    <Stack
      id={id}
      data-observation-value-display
      data-observation-code={ObservationKit.toText(observationCode).trim() || undefined}
      horizontal={inline}
      verticalAlign={inline ? "center" : undefined}
      tokens={{ childrenGap: inline ? 8 : 2 }}
      styles={{ root: { width: "100%", minWidth: 0, ...(inline ? { flexWrap: "wrap" } : {}) } }}
    >
      {showLabel ? <Label>{label}</Label> : null}
      {body}
      {graphLinkText ? (
        graphHref ? (
          <Link href={graphHref} target="_blank" rel="noopener noreferrer">{graphLinkText}</Link>
        ) : (
          <Text variant="small" styles={{ root: { color: "#0f5ea8" } }}>{graphLinkText}</Text>
        )
      ) : null}
      {windowLabel ? <Text variant="small" styles={{ root: { color: "#605e5c" } }}>{windowLabel}</Text> : null}
    </Stack>
  )
}
