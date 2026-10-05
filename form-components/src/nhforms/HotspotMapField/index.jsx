/**
 * HotspotMapField
 *
 * A picture with selectable hotspot regions, counter groups, optional number
 * boxes and symbol / freehand annotations — rendered on the shared Drawer
 * selection surface (DrawerDiagramField). The props and the stored value are
 * unchanged, so saved forms, subforms (SubformScoring "hotspotMap" fields),
 * formulas and observation templates keep working:
 *
 *   fd.field.data[fieldId] = {
 *     selectedIds, selectedLabels, selectedCount, byHotspot,
 *     countsByGroup, labelsByGroup,          // e.g. {{joints.countsByGroup.CDAI_SDAI}}
 *     annotations, annotationCount, updatedAt
 *   }
 *
 * Hotspots { id, label, shape: rect|circle|polygon, x, y, width, height,
 * radius, points (percent of the picture), fieldId, group } become Drawer
 * areas; counterGroups { id, label, showCounter, hotspotIds } become groups;
 * annotations are Drawer marks. Conversion: lib/drawer/hotspot.ts, reached
 * through DrawerDiagramField.runtime.
 */

const HOTSPOT_SYMBOLS = ["x", "circle", "triangle"]

const parseHotspotSymbol = (value) => {
  if (typeof value !== "string") return null
  const s = value.trim().toLowerCase()
  if (s === "triangle" || s === "▲") return "triangle"
  if (s === "circle" || s === "x") return s
  return null
}

const hotspotSymbols = (value, defaultSymbol) => {
  const list = []
  const add = (entry) => {
    const parsed = parseHotspotSymbol(entry)
    if (parsed && !list.includes(parsed)) list.push(parsed)
  }
  if (Array.isArray(value)) value.forEach(add)
  else if (typeof value === "string") value.split(/[,\s|]+/).forEach(add)
  if (!list.length) HOTSPOT_SYMBOLS.forEach(add)
  const first = parseHotspotSymbol(defaultSymbol) || list[0]
  return list.includes(first) ? [first, ...list.filter((s) => s !== first)] : [first, ...list]
}

const hotspotInteractionMode = (mode, enableAnnotations) => {
  if (typeof mode !== "string" || !mode.trim()) return enableAnnotations === true ? "symbol_draw" : "select"
  const c = mode.trim().toLowerCase().replace(/[^a-z]/g, "")
  if (c === "fieldfill" || c === "imagefieldfill" || c === "fill" || c === "fillmode") return "field_fill"
  if (c === "symbol" || c === "symbolmode") return "symbol"
  if (c === "draw" || c === "drawmode") return "draw"
  if (c === "symboldraw" || c === "drawsymbol" || c === "symbolanddraw" || c === "drawandsymbol") return "symbol_draw"
  return "select"
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
  showDefaultCounter = true,
  showSelectedLabels = false,
  showHotspotLabels = false,
  totalCountLabel = "Selected",
  counterGroups,
  openInModal = false,
  modalButtonText = "Open Map",
  modalTitle = "",
  modalMinWidth = 760,
  mapZoomPercent = 100,
  mapWidthPercent = 100,
  mapMaxWidth = 560,
  mapMinHeight = 220,
  mapPaddingPx = 12,
  mapMarginPx = 0,
  markerSize = 3,
  interactionMode,
  enableAnnotations = false,
  annotationDefaultSymbol = "x",
  annotationSymbols = HOTSPOT_SYMBOLS,
  annotationDefaultColor = "#ef4444",
  annotationSizePercent = 2.2,
  numberFields = [],
  totalCountFieldId,
  selectedIdsFieldId,
  selectedLabelsFieldId,
  required = false,
  readOnly = false,
}) => {
  const { useMemo, useState, useEffect, useCallback } = React
  const runtime = DrawerDiagramField.runtime
  const useFormData = typeof useFormSessionData === "function" ? useFormSessionData : useActiveData
  const [fd] = useFormData()
  const theme = typeof useTheme === "function" ? useTheme() : null
  const isDarkMode = !!(theme && theme.isInverted)
  const mode = hotspotInteractionMode(interactionMode, enableAnnotations)
  const symbols = useMemo(() => hotspotSymbols(annotationSymbols, annotationDefaultSymbol), [annotationSymbols, annotationDefaultSymbol])
  const sizePercent = Number(annotationSizePercent) > 0 ? Math.max(0.5, Math.min(20, Number(annotationSizePercent))) : 2.2
  const color = typeof annotationDefaultColor === "string" && annotationDefaultColor.trim() ? annotationDefaultColor.trim() : "#ef4444"

  // A raster picture needs its natural size before areas can be placed.
  const hasSvg = typeof imageSvg === "string" && /<svg[\s>]/i.test(imageSvg)
  const [rasterSize, setRasterSize] = useState(null)
  useEffect(() => {
    // createElement, not `new Image()`: the form scope injects an Image
    // control under that name, which is not a constructor.
    if (hasSvg || !imageUrl || typeof document === "undefined") return undefined
    let alive = true
    const img = document.createElement("img")
    img.onload = () => { if (alive) setRasterSize({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 }) }
    img.src = imageUrl
    return () => { alive = false }
  }, [hasSvg, imageUrl])

  const numberFieldList = useMemo(() => runtime.normalizeNumberFields(numberFields), [numberFields])
  const data = (fd && fd.field && fd.field.data) || {}
  // Field-fill mode writes the number boxes' values into the picture's <text id> layers.
  const textValuesKey = mode === "field_fill"
    ? numberFieldList.map((nf) => {
      const v = data[nf.fieldId]
      return `${nf.id}=${v == null || (typeof v === "string" && !v.trim()) ? "#" : String(v)}`
    }).join("\u0001")
    : ""
  const surface = useMemo(() => {
    const textValues = textValuesKey
      ? Object.fromEntries(textValuesKey.split("\u0001").map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]))
      : undefined
    try {
      return runtime.hotspotSurface({ imageUrl, imageSvg, imageAlt, hotspots, counterGroups, markerSize, rasterSize, textValues })
    } catch (error) {
      return null
    }
  }, [imageUrl, imageSvg, imageAlt, hotspots, counterGroups, markerSize, rasterSize, textValuesKey])

  const readValue = useCallback((stored) => {
    const areaIds = new Set(surface ? surface.hotspots.map((h) => h.id) : [])
    const areas = {}
    if (stored && Array.isArray(stored.selectedIds)) {
      stored.selectedIds.forEach((id) => { if (typeof id === "string" && areaIds.has(id.trim())) areas[id.trim()] = true })
    }
    const marks = surface && stored ? runtime.annotationsToMarks(stored.annotations, surface, { color, size: sizePercent, symbol: symbols[0] }) : []
    return { sites: {}, areas, marks }
  }, [surface, color, sizePercent, symbols])
  const writeValue = useCallback((value) => (surface ? runtime.toHotspotValue(value, surface) : null), [surface])

  const areaFieldIds = useMemo(() => {
    const map = {}
    if (surface) surface.hotspots.forEach((h) => { if (h.fieldId) map[h.id] = h.fieldId })
    return map
  }, [surface])
  const inputs = useMemo(() => {
    if (!surface) return []
    return numberFieldList.map((nf) => ({
      ...nf,
      ...surface.toPage({ x: nf.x, y: nf.y }),
      width: (nf.width / 100) * surface.width,
      takeover: mode === "field_fill" && surface.textIds.has(nf.id),
    }))
  }, [surface, numberFieldList, mode])

  const marksOn = mode === "symbol" || mode === "draw" || mode === "symbol_draw"
  const markTools = [...(mode === "symbol" || mode === "symbol_draw" ? symbols : []), ...(mode === "draw" || mode === "symbol_draw" ? ["draw"] : [])]
  const groups = surface && surface.doc.groups ? surface.doc.groups : []
  const muted = { fontSize: "11px", color: isDarkMode ? "#d1d5db" : "#4b5563" }

  const renderSummary = ({ value }) => {
    if (!showSummary) return null
    const stored = value && surface ? runtime.toHotspotValue(value, surface, () => "") : null
    const counts = stored ? stored.countsByGroup : {}
    const shownGroups = groups.length
      ? groups.filter((g) => g.showCount !== false)
      : [...new Set((surface ? surface.hotspots : []).map((h) => h.group).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((g) => ({ id: g, label: g }))
    return (
      <Fluent.Stack tokens={{ childrenGap: 4 }}>
        {showDefaultCounter && mode !== "field_fill" ? (
          <Fluent.Text variant="small">{totalCountLabel || "Selected"}: <strong>{stored ? stored.selectedCount : 0}</strong></Fluent.Text>
        ) : null}
        {shownGroups.map((g) => (
          <Fluent.Text key={g.id} variant="small" styles={{ root: muted }}>{g.label}: <strong>{Number(counts[g.id] || 0)}</strong></Fluent.Text>
        ))}
        {marksOn ? <Fluent.Text variant="small" styles={{ root: muted }}>Annotations: <strong>{stored ? stored.annotationCount : 0}</strong></Fluent.Text> : null}
        {showSelectedLabels && stored && stored.selectedLabels.length ? (
          <Fluent.Text variant="small" styles={{ root: muted }}>{stored.selectedLabels.join(", ")}</Fluent.Text>
        ) : null}
      </Fluent.Stack>
    )
  }

  if (!surface) {
    return (
      <Fluent.Stack tokens={{ childrenGap: 8 }}>
        {label ? <Fluent.Label required={required}>{label}</Fluent.Label> : null}
        <div style={{ minHeight: `${Math.max(120, Number(mapMinHeight) || 220)}px`, display: "flex", alignItems: "center", justifyContent: "center", color: isDarkMode ? "#9ca3af" : "#6b7280", fontSize: "12px" }}>
          {imageUrl && !hasSvg ? "Loading map…" : "Configure imageUrl or imageSvg to render the map."}
        </div>
      </Fluent.Stack>
    )
  }

  const zoom = Math.max(25, Math.min(300, Number(mapZoomPercent) || 100)) / 100
  const padding = Math.max(0, Math.min(120, Number(mapPaddingPx) || 0))
  const margin = Math.max(0, Math.min(120, Number(mapMarginPx) || 0))
  return (
    <DrawerDiagramField
      fieldId={fieldId}
      label={label}
      mode="select"
      multiple={allowMultiSelect !== false}
      targets={{ sites: false, areas: mode === "select", marks: marksOn }}
      markTools={markTools}
      markColor={color}
      markSize={(sizePercent / 100) * surface.width}
      marksSelect={false}
      showSiteLegend={false}
      showCallouts={false}
      connections="none"
      areaOutlines="always"
      areaLabels={!!showHotspotLabels}
      selectedColor="#2563eb"
      inputs={inputs}
      maxWidth={Math.max(220, Number(mapMaxWidth) || 560) * zoom}
      openInModal={!!openInModal}
      modalButtonText={modalButtonText || "Open Map"}
      modalTitle={modalTitle || label || "Map Selection"}
      modalMinWidth={Math.max(360, Number(modalMinWidth) || 760)}
      imageAlt={imageAlt}
      areaFieldIds={areaFieldIds}
      selectedCountFieldId={totalCountFieldId || ""}
      selectedIdsFieldId={selectedIdsFieldId || ""}
      selectedLabelsFieldId={selectedLabelsFieldId || ""}
      required={required}
      readOnly={readOnly}
      __doc={surface.doc}
      __readValue={readValue}
      __writeValue={writeValue}
      __renderSummary={renderSummary}
      __frameStyle={{
        width: `${Math.max(20, Math.min(100, Number(mapWidthPercent) || 100))}%`,
        minHeight: `${Math.max(120, Number(mapMinHeight) || 220) * zoom}px`,
        margin: `${margin}px auto`,
        borderRadius: "6px",
        overflow: "hidden",
        border: `1px solid ${isDarkMode ? "#333333" : "#e0e0e0"}`,
        backgroundColor: isDarkMode ? "#171717" : "#fafafa",
      }}
      __panelStyle={{
        border: `1px solid ${isDarkMode ? "#404040" : "#d0d7de"}`,
        borderRadius: "8px",
        backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
        padding: `${padding}px`,
        margin: 0,
      }}
    />
  )
}
