/**
 * HotspotMapField
 *
 * Generic image/SVG map with selectable hotspot overlays.
 * - Supports imageUrl or inline imageSvg
 * - Stores selection state in fd.field.data[fieldId]
 * - Optional writeback fields for count and selected labels/ids
 * - Optional per-hotspot fieldId writebacks (boolean)
 *
 * Hotspot config shape:
 * {
 *   id: string,
 *   label?: string,
 *   shape?: "rect" | "circle",
 *   x: number, // percent
 *   y: number, // percent
 *   width?: number, // percent (rect)
 *   height?: number, // percent (rect)
 *   radius?: number, // percent (circle)
 *   fieldId?: string,
 *   group?: string
 * }
 */

const { useMemo, useCallback } = React
const { Label, Text, Stack } = Fluent

const DEFAULT_MARKER_SIZE = 3
const DEFAULT_MARKER_RADIUS = 1.5

const clampPercent = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  if (numeric < 0) return 0
  if (numeric > 100) return 100
  return numeric
}

const normalizeString = (value, fallback = "") => {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

const normalizeShape = (value) => {
  const normalized = normalizeString(value, "rect").toLowerCase()
  return normalized === "circle" ? "circle" : "rect"
}

const normalizeHotspots = (hotspots, markerSize = DEFAULT_MARKER_SIZE) => {
  if (!Array.isArray(hotspots)) return []
  const usedIds = new Set()

  return hotspots
    .map((hotspot, index) => {
      if (!hotspot || typeof hotspot !== "object") return null
      const rawId = normalizeString(hotspot.id, `hotspot_${index + 1}`)
      let id = rawId
      let suffix = 2
      while (usedIds.has(id)) {
        id = `${rawId}_${suffix}`
        suffix += 1
      }
      usedIds.add(id)

      const shape = normalizeShape(hotspot.shape)
      const x = clampPercent(hotspot.x)
      const y = clampPercent(hotspot.y)

      const normalizedHotspot = {
        id,
        label: normalizeString(hotspot.label, id),
        shape,
        x,
        y,
        fieldId: normalizeString(hotspot.fieldId, ""),
        group: normalizeString(hotspot.group, ""),
      }

      if (shape === "circle") {
        const radius = clampPercent(
          hotspot.radius != null ? hotspot.radius : markerSize / 2 || DEFAULT_MARKER_RADIUS
        )
        normalizedHotspot.radius = radius > 0 ? radius : DEFAULT_MARKER_RADIUS
      } else {
        const width = clampPercent(hotspot.width != null ? hotspot.width : markerSize)
        const height = clampPercent(hotspot.height != null ? hotspot.height : markerSize)
        normalizedHotspot.width = width > 0 ? width : markerSize
        normalizedHotspot.height = height > 0 ? height : markerSize
      }

      return normalizedHotspot
    })
    .filter(Boolean)
}

const ensureResponsiveSvg = (markup) => {
  const input = typeof markup === "string" ? markup.trim() : ""
  if (!input) return ""
  if (!/<svg[\s>]/i.test(input)) return input

  // If the root <svg> already defines inline style, keep as-is.
  if (/<svg[^>]*style\s*=/i.test(input)) return input

  return input.replace(
    /<svg\b/i,
    '<svg style="width:100%;height:auto;display:block;max-width:100%;"'
  )
}

const buildCountsByGroup = (selectedIds, hotspotsById) => {
  const counts = {}
  selectedIds.forEach((id) => {
    const hotspot = hotspotsById.get(id)
    if (!hotspot) return
    const group = hotspot.group || "default"
    counts[group] = (counts[group] || 0) + 1
  })
  return counts
}

const buildMapValue = (selectedIds, hotspots, hotspotsById) => {
  const byHotspot = {}
  const selectedLabels = []
  hotspots.forEach((hotspot) => {
    const isSelected = selectedIds.has(hotspot.id)
    byHotspot[hotspot.id] = isSelected
    if (isSelected) {
      selectedLabels.push(hotspot.label || hotspot.id)
    }
  })

  return {
    selectedIds: hotspots.filter((hotspot) => selectedIds.has(hotspot.id)).map((hotspot) => hotspot.id),
    selectedLabels,
    selectedCount: selectedLabels.length,
    byHotspot,
    countsByGroup: buildCountsByGroup(selectedIds, hotspotsById),
    updatedAt: new Date().toISOString(),
  }
}

const createHotspotMapConfig = (config = {}) => ({
  imageUrl: normalizeString(config.imageUrl, ""),
  imageSvg: normalizeString(config.imageSvg, ""),
  imageAlt: normalizeString(config.imageAlt, "Map"),
  allowMultiSelect: config.allowMultiSelect !== false,
  showSummary: config.showSummary !== false,
  showHotspotLabels: config.showHotspotLabels === true,
  markerSize:
    Number.isFinite(Number(config.markerSize)) && Number(config.markerSize) > 0
      ? Number(config.markerSize)
      : DEFAULT_MARKER_SIZE,
  hotspots: normalizeHotspots(config.hotspots, config.markerSize ?? DEFAULT_MARKER_SIZE),
})

const importSvgHotspots = (svgMarkup) => {
  if (!svgMarkup || typeof svgMarkup !== "string") return []
  if (typeof DOMParser === "undefined") return []

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgMarkup, "image/svg+xml")
    const svg = doc.querySelector("svg")
    if (!svg) return []

    const viewBoxRaw = normalizeString(svg.getAttribute("viewBox"), "")
    const viewBoxParts = viewBoxRaw.split(/\s+/).map((part) => Number(part))
    const vbWidth = Number.isFinite(viewBoxParts[2]) ? viewBoxParts[2] : null
    const vbHeight = Number.isFinite(viewBoxParts[3]) ? viewBoxParts[3] : null

    const widthAttr = Number(svg.getAttribute("width"))
    const heightAttr = Number(svg.getAttribute("height"))
    const sourceWidth = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : vbWidth || 100
    const sourceHeight = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : vbHeight || 100

    const toXPercent = (value) => clampPercent((Number(value) / sourceWidth) * 100)
    const toYPercent = (value) => clampPercent((Number(value) / sourceHeight) * 100)

    const elements = Array.from(
      svg.querySelectorAll("rect[data-hotspot-id], rect[id], circle[data-hotspot-id], circle[id], ellipse[data-hotspot-id], ellipse[id]")
    )

    return elements
      .map((element, index) => {
        const rawId = normalizeString(
          element.getAttribute("data-hotspot-id"),
          normalizeString(element.getAttribute("id"), `hotspot_${index + 1}`)
        )
        const rawLabel = normalizeString(element.getAttribute("data-hotspot-label"), rawId)

        if (element.tagName.toLowerCase() === "rect") {
          const x = toXPercent(element.getAttribute("x") || 0)
          const y = toYPercent(element.getAttribute("y") || 0)
          const width = toXPercent(element.getAttribute("width") || 0)
          const height = toYPercent(element.getAttribute("height") || 0)
          return {
            id: rawId,
            label: rawLabel,
            shape: "rect",
            x,
            y,
            width: width > 0 ? width : DEFAULT_MARKER_SIZE,
            height: height > 0 ? height : DEFAULT_MARKER_SIZE,
          }
        }

        const cx = toXPercent(element.getAttribute("cx") || 0)
        const cy = toYPercent(element.getAttribute("cy") || 0)
        const r = element.tagName.toLowerCase() === "ellipse"
          ? (toXPercent(element.getAttribute("rx") || 0) + toYPercent(element.getAttribute("ry") || 0)) / 2
          : toXPercent(element.getAttribute("r") || 0)

        return {
          id: rawId,
          label: rawLabel,
          shape: "circle",
          x: cx,
          y: cy,
          radius: r > 0 ? r : DEFAULT_MARKER_RADIUS,
        }
      })
      .filter(Boolean)
  } catch (error) {
    return []
  }
}

const HotspotMapField = ({
  fieldId,
  label,
  imageUrl = "",
  imageSvg = "",
  imageAlt = "Map",
  hotspots = [],
  allowMultiSelect = true,
  showSummary = true,
  showHotspotLabels = false,
  markerSize = DEFAULT_MARKER_SIZE,
  totalCountFieldId,
  selectedIdsFieldId,
  selectedLabelsFieldId,
  required = false,
  readOnly = false,
}) => {
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  const normalizedHotspots = useMemo(
    () => normalizeHotspots(hotspots, markerSize),
    [hotspots, markerSize]
  )
  const hotspotsById = useMemo(() => {
    const map = new Map()
    normalizedHotspots.forEach((hotspot) => map.set(hotspot.id, hotspot))
    return map
  }, [normalizedHotspots])

  const mapValue = fd?.field?.data?.[fieldId]
  const selectedIds = useMemo(() => {
    if (!Array.isArray(mapValue?.selectedIds)) return new Set()
    return new Set(
      mapValue.selectedIds
        .map((value) => normalizeString(value, ""))
        .filter((value) => value.length > 0)
    )
  }, [mapValue])

  const commitSelection = useCallback((nextSelectedIds) => {
    if (!fieldId || !fd?.setFormData) return

    const value = buildMapValue(nextSelectedIds, normalizedHotspots, hotspotsById)
    const hasSelections = value.selectedCount > 0
    const selectedIdsCsv = value.selectedIds.join(",")
    const selectedLabelsCsv = value.selectedLabels.join(", ")

    fd.setFormData(
      produce((draft) => {
        if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
        if (!draft.field.data) draft.field.data = {}
        draft.field.data[fieldId] = hasSelections ? value : null

        if (totalCountFieldId) {
          draft.field.data[totalCountFieldId] = value.selectedCount
        }
        if (selectedIdsFieldId) {
          draft.field.data[selectedIdsFieldId] = selectedIdsCsv
        }
        if (selectedLabelsFieldId) {
          draft.field.data[selectedLabelsFieldId] = selectedLabelsCsv
        }

        normalizedHotspots.forEach((hotspot) => {
          if (!hotspot.fieldId) return
          draft.field.data[hotspot.fieldId] = value.byHotspot[hotspot.id] === true
        })
      })
    )
  }, [
    fd,
    fieldId,
    normalizedHotspots,
    hotspotsById,
    selectedIdsFieldId,
    selectedLabelsFieldId,
    totalCountFieldId,
  ])

  const handleToggleHotspot = useCallback((hotspotId) => {
    if (readOnly) return
    const next = new Set(selectedIds)

    if (allowMultiSelect) {
      if (next.has(hotspotId)) {
        next.delete(hotspotId)
      } else {
        next.add(hotspotId)
      }
    } else if (next.has(hotspotId)) {
      next.clear()
    } else {
      next.clear()
      next.add(hotspotId)
    }

    commitSelection(next)
  }, [allowMultiSelect, commitSelection, readOnly, selectedIds])

  const responsiveSvg = useMemo(() => ensureResponsiveSvg(imageSvg), [imageSvg])
  const selectedLabels = Array.isArray(mapValue?.selectedLabels) ? mapValue.selectedLabels : []
  const selectedCount = Number.isFinite(mapValue?.selectedCount) ? mapValue.selectedCount : selectedIds.size

  const panelStyle = {
    border: `1px solid ${isDarkMode ? "#404040" : "#d0d7de"}`,
    borderRadius: "8px",
    backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
    padding: "10px",
  }

  const mapFrameStyle = {
    position: "relative",
    width: "100%",
    borderRadius: "6px",
    overflow: "hidden",
    border: `1px solid ${isDarkMode ? "#333333" : "#e0e0e0"}`,
    backgroundColor: isDarkMode ? "#171717" : "#fafafa",
  }

  const overlayStyle = {
    position: "absolute",
    inset: 0,
  }

  const markerBaseStyle = {
    position: "absolute",
    cursor: readOnly ? "default" : "pointer",
    border: "2px solid #1f2937",
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  }

  return (
    <Stack tokens={{ childrenGap: 8 }} style={panelStyle}>
      {label && (
        <Label required={required} styles={{ root: { marginBottom: 0 } }}>
          {label}
        </Label>
      )}

      <div style={mapFrameStyle}>
        {responsiveSvg ? (
          <div
            style={{ width: "100%", lineHeight: 0, pointerEvents: "none" }}
            dangerouslySetInnerHTML={{ __html: responsiveSvg }}
          />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            style={{ display: "block", width: "100%", height: "auto", pointerEvents: "none" }}
          />
        ) : (
          <div
            style={{
              minHeight: "220px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDarkMode ? "#9ca3af" : "#6b7280",
              fontSize: "12px",
            }}
          >
            Configure imageUrl or imageSvg to render the map.
          </div>
        )}

        <div style={overlayStyle}>
          {normalizedHotspots.map((hotspot) => {
            const isSelected = selectedIds.has(hotspot.id)
            const base = {
              ...markerBaseStyle,
              borderColor: isSelected ? "#1d4ed8" : "#374151",
              backgroundColor: isSelected ? "#2563eb" : "#ffffff",
              color: isSelected ? "#ffffff" : "#111827",
            }

            const style =
              hotspot.shape === "circle"
                ? {
                    ...base,
                    left: `${hotspot.x - hotspot.radius}%`,
                    top: `${hotspot.y - hotspot.radius}%`,
                    width: `${hotspot.radius * 2}%`,
                    height: `${hotspot.radius * 2}%`,
                    borderRadius: "9999px",
                  }
                : {
                    ...base,
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    width: `${hotspot.width}%`,
                    height: `${hotspot.height}%`,
                    borderRadius: "3px",
                  }

            return (
              <button
                key={hotspot.id}
                type="button"
                style={style}
                aria-pressed={isSelected}
                title={hotspot.label || hotspot.id}
                onClick={() => handleToggleHotspot(hotspot.id)}
              >
                {showHotspotLabels ? (
                  <span style={{ fontSize: "10px", fontWeight: 600, padding: "0 2px", lineHeight: 1.1 }}>
                    {hotspot.label || hotspot.id}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {showSummary && (
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="small">
            Selected: <strong>{selectedCount}</strong>
          </Text>
          {selectedLabels.length > 0 && (
            <Text variant="small" styles={{ root: { fontSize: "11px", color: isDarkMode ? "#d1d5db" : "#4b5563" } }}>
              {selectedLabels.join(", ")}
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  )
}

HotspotMapField.createConfig = createHotspotMapConfig
HotspotMapField.importSvgHotspots = importSvgHotspots
HotspotMapField.normalizeHotspots = normalizeHotspots

