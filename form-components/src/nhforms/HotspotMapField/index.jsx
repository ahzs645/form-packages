/**
 * HotspotMapField
 *
 * Generic image/SVG map with selectable hotspot overlays.
 * - Supports imageUrl (including base64 data URLs) or inline imageSvg
 * - Stores selection state in fd.field.data[fieldId]
 * - Optional writeback fields for count and selected labels/ids
 * - Optional per-hotspot fieldId writebacks (boolean)
 * - Optional positioned numeric inputs over the map (numberFields)
 * - Optional multi-counter summary using counterGroups
 * - Backward compatible fallback summary using hotspot.group values
 *
 * Hotspot config shape:
 * {
 *   id: string,
 *   label?: string,
 *   shape?: "rect" | "circle" | "polygon",
 *   x: number, // percent
 *   y: number, // percent
 *   width?: number, // percent (rect)
 *   height?: number, // percent (rect)
 *   radius?: number, // percent (circle)
 *   points?: [{ x: number, y: number }], // percent (polygon)
 *   fieldId?: string,
 *   group?: string
 * }
 *
 * Counter group config shape:
 * {
 *   id: string,
 *   label?: string,
 *   showCounter?: boolean,
 *   hotspotIds?: string[]
 * }
 *
 * Number field config shape:
 * {
 *   id: string,
 *   fieldId?: string,
 *   label?: string,
 *   x: number, // percent
 *   y: number, // percent
 *   width?: number, // percent
 *   placeholder?: string,
 *   min?: number,
 *   max?: number,
 *   step?: number
 * }
 */

const { useMemo, useCallback, useEffect, useRef, useState } = React
const { Label, Text, Stack, PrimaryButton, Dialog, DialogType, DialogFooter } = Fluent

const DEFAULT_MARKER_SIZE = 3
const DEFAULT_MARKER_RADIUS = 1.5
const DEFAULT_MAP_ZOOM_PERCENT = 100
const DEFAULT_MAP_WIDTH_PERCENT = 100
const DEFAULT_MAP_MAX_WIDTH = 560
const DEFAULT_MAP_MIN_HEIGHT = 220
const DEFAULT_MAP_PADDING_PX = 12
const DEFAULT_MAP_MARGIN_PX = 0
const DEFAULT_SVG_VIEWBOX_MARGIN_PERCENT = 2
const DEFAULT_NUMBER_FIELD_WIDTH_PERCENT = 12
const DEFAULT_ANNOTATION_COLOR = "#ef4444"
const DEFAULT_ANNOTATION_SYMBOL = "x"
const DEFAULT_ANNOTATION_SYMBOLS = ["x", "circle", "triangle"]
const ANNOTATION_SYMBOL_LABELS = {
  x: "X",
  circle: "Circle",
  triangle: "▲",
}
const DEFAULT_ANNOTATION_SIZE_PERCENT = 2.2
const DEFAULT_INTERACTION_MODE = "select"

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

const parseAnnotationSymbol = (value) => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === "triangle" || normalized === "▲") return "triangle"
  if (normalized === "circle") return "circle"
  if (normalized === "x") return "x"
  return null
}

const normalizeAnnotationSymbol = (value, fallback = DEFAULT_ANNOTATION_SYMBOL) => {
  return parseAnnotationSymbol(value) || parseAnnotationSymbol(fallback) || DEFAULT_ANNOTATION_SYMBOL
}

const normalizeAnnotationSymbols = (
  value,
  fallback = DEFAULT_ANNOTATION_SYMBOLS,
  defaultSymbol = DEFAULT_ANNOTATION_SYMBOL
) => {
  const parseList = (input) => {
    const symbols = []
    const seen = new Set()
    const append = (entry) => {
      const parsed = parseAnnotationSymbol(entry)
      if (!parsed || seen.has(parsed)) return
      seen.add(parsed)
      symbols.push(parsed)
    }

    if (Array.isArray(input)) {
      input.forEach((entry) => append(entry))
    } else if (typeof input === "string") {
      input
        .split(/[,\s|]+/)
        .forEach((entry) => append(entry))
    }

    return symbols
  }

  const parsed = parseList(value)
  const fallbackList = parseList(fallback)
  const resolved = parsed.length > 0
    ? parsed
    : fallbackList.length > 0
      ? fallbackList
      : [DEFAULT_ANNOTATION_SYMBOL]
  const ensuredDefault = normalizeAnnotationSymbol(defaultSymbol, resolved[0] || DEFAULT_ANNOTATION_SYMBOL)
  return resolved.includes(ensuredDefault) ? resolved : [ensuredDefault, ...resolved]
}

const resolveAnnotationSymbol = (value, fallback, allowedSymbols = DEFAULT_ANNOTATION_SYMBOLS) => {
  const symbol = normalizeAnnotationSymbol(value, fallback)
  if (Array.isArray(allowedSymbols) && allowedSymbols.includes(symbol)) {
    return symbol
  }
  return normalizeAnnotationSymbol(allowedSymbols[0], fallback)
}

const normalizeMapInteractionMode = (value, fallback = DEFAULT_INTERACTION_MODE) => {
  if (typeof value !== "string") return fallback
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "")
  if (compact === "select" || compact === "selectmode") return "select"
  if (
    compact === "fieldfill" ||
    compact === "imagefieldfill" ||
    compact === "fill" ||
    compact === "fillmode"
  ) {
    return "field_fill"
  }
  if (compact === "symbol" || compact === "symbolmode") return "symbol"
  if (compact === "draw" || compact === "drawmode") return "draw"
  if (
    compact === "symboldraw" ||
    compact === "drawsymbol" ||
    compact === "symbolanddraw" ||
    compact === "drawandsymbol"
  ) {
    return "symbol_draw"
  }
  return "select"
}

const resolveMapInteractionMode = (mode, enableAnnotations) => {
  if (typeof mode === "string" && mode.trim()) {
    return normalizeMapInteractionMode(mode, DEFAULT_INTERACTION_MODE)
  }
  return enableAnnotations === true ? "symbol_draw" : "select"
}

const normalizeAnnotationType = (value, fallback = "symbol") => {
  const normalized = normalizeString(value, fallback).toLowerCase()
  return normalized === "stroke" ? "stroke" : "symbol"
}

const normalizeColor = (value, fallback = DEFAULT_ANNOTATION_COLOR) => {
  const normalized = normalizeString(value, fallback)
  return normalized || fallback
}

const normalizeAnnotationPoints = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((point) => {
      if (!point || typeof point !== "object") return null
      return {
        x: clampPercent(point.x),
        y: clampPercent(point.y),
      }
    })
    .filter(Boolean)
}

const annotationPointsToSvgString = (points) =>
  (Array.isArray(points) ? points : [])
    .map((point) => `${point.x},${point.y}`)
    .join(" ")

const normalizeCounterGroupId = (value, fallback) => {
  if (typeof value !== "string") return fallback
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return normalized || fallback
}

const parseSvgNumber = (value) => {
  const raw = normalizeString(value, "")
  if (!raw) return null
  const match = raw.match(/-?\d+(\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeShape = (value) => {
  const normalized = normalizeString(value, "rect").toLowerCase()
  if (normalized === "polygon") return "polygon"
  if (normalized === "circle") return "circle"
  return "rect"
}

const centroidFromPoints = (points) => {
  if (!Array.isArray(points) || points.length === 0) {
    return { x: 0, y: 0 }
  }
  const total = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 }
  )
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  }
}

const buildFallbackPolygon = (x, y, markerSize) => {
  const half = Math.max(0.5, markerSize / 2)
  return [
    { x: clampPercent(x - half), y: clampPercent(y - half) },
    { x: clampPercent(x + half), y: clampPercent(y - half) },
    { x: clampPercent(x + half), y: clampPercent(y + half) },
    { x: clampPercent(x - half), y: clampPercent(y + half) },
  ]
}

const normalizeHotspotPoints = (value) => {
  if (typeof value === "string") {
    if (!value.trim()) return []
    return value
      .trim()
      .split(/\s+/)
      .map((entry) => {
        const parts = entry.split(",")
        if (parts.length < 2) return null
        const x = clampPercent(parts[0])
        const y = clampPercent(parts[1])
        return { x, y }
      })
      .filter(Boolean)
  }

  if (!Array.isArray(value)) return []
  return value
    .map((point) => {
      if (!point || typeof point !== "object") return null
      return {
        x: clampPercent(point.x),
        y: clampPercent(point.y),
      }
    })
    .filter(Boolean)
}

const pointsToSvgString = (points) =>
  (Array.isArray(points) ? points : [])
    .map((point) => `${point.x},${point.y}`)
    .join(" ")

const normalizeAnnotations = (
  annotations,
  defaultSymbol = DEFAULT_ANNOTATION_SYMBOL,
  defaultColor = DEFAULT_ANNOTATION_COLOR,
  defaultSize = DEFAULT_ANNOTATION_SIZE_PERCENT,
  allowedSymbols = DEFAULT_ANNOTATION_SYMBOLS
) => {
  if (!Array.isArray(annotations)) return []
  const resolvedAllowedSymbols = normalizeAnnotationSymbols(
    allowedSymbols,
    DEFAULT_ANNOTATION_SYMBOLS,
    defaultSymbol
  )
  return annotations
    .map((annotation, index) => {
      if (!annotation || typeof annotation !== "object") return null
      const id = normalizeString(annotation.id, `annotation_${index + 1}`)
      const type = normalizeAnnotationType(
        annotation.type,
        Array.isArray(annotation.points) ? "stroke" : "symbol"
      )
      const color = normalizeColor(annotation.color, defaultColor)
      const size =
        Number.isFinite(Number(annotation.size)) && Number(annotation.size) > 0
          ? Math.max(0.5, Math.min(20, Number(annotation.size)))
          : defaultSize
      if (type === "stroke") {
        const points = normalizeAnnotationPoints(annotation.points)
        if (points.length < 2) return null
        return {
          id,
          type: "stroke",
          color,
          size,
          points,
        }
      }
      const x = clampPercent(annotation.x)
      const y = clampPercent(annotation.y)
      const symbol = resolveAnnotationSymbol(annotation.symbol, defaultSymbol, resolvedAllowedSymbols)
      return {
        id,
        type: "symbol",
        x,
        y,
        symbol,
        color,
        size,
      }
    })
    .filter(Boolean)
}

const normalizeNumberFields = (value) => {
  if (!Array.isArray(value)) return []
  const usedIds = new Set()

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const baseId = normalizeCounterGroupId(item.id, `number_field_${index + 1}`)
      let id = baseId
      let suffix = 2
      while (usedIds.has(id)) {
        id = `${baseId}_${suffix}`
        suffix += 1
      }
      usedIds.add(id)

      const fieldId = normalizeString(item.fieldId != null ? item.fieldId : item.field_id, id)
      const widthRaw = Number(item.width)
      const width = Number.isFinite(widthRaw)
        ? Math.max(6, Math.min(40, widthRaw))
        : DEFAULT_NUMBER_FIELD_WIDTH_PERCENT
      const min = Number.isFinite(Number(item.min)) ? Number(item.min) : undefined
      const max = Number.isFinite(Number(item.max)) ? Number(item.max) : undefined
      const step = Number.isFinite(Number(item.step)) && Number(item.step) > 0 ? Number(item.step) : undefined

      return {
        id,
        fieldId,
        label: normalizeString(item.label, ""),
        x: clampPercent(item.x),
        y: clampPercent(item.y),
        width,
        placeholder: normalizeString(item.placeholder, ""),
        min,
        max,
        step,
      }
    })
    .filter(Boolean)
}

const getHotspotLabelAnchor = (hotspot) => {
  if (hotspot.shape === "circle") {
    return { x: hotspot.x, y: hotspot.y }
  }
  if (hotspot.shape === "polygon" && Array.isArray(hotspot.points) && hotspot.points.length > 0) {
    return centroidFromPoints(hotspot.points)
  }
  return {
    x: hotspot.x + (hotspot.width || 0) / 2,
    y: hotspot.y + (hotspot.height || 0) / 2,
  }
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
        width: markerSize,
        height: markerSize,
        radius: Math.max(DEFAULT_MARKER_RADIUS, markerSize / 2),
        fieldId: normalizeString(hotspot.fieldId, ""),
        group: normalizeString(hotspot.group, ""),
      }

      if (shape === "circle") {
        const radius = clampPercent(
          hotspot.radius != null ? hotspot.radius : markerSize / 2 || DEFAULT_MARKER_RADIUS
        )
        normalizedHotspot.radius = radius > 0 ? radius : DEFAULT_MARKER_RADIUS
      } else if (shape === "polygon") {
        const parsedPoints = normalizeHotspotPoints(hotspot.points)
        const points = parsedPoints.length >= 3 ? parsedPoints : buildFallbackPolygon(x, y, markerSize)
        normalizedHotspot.points = points
        const centroid = centroidFromPoints(points)
        normalizedHotspot.x = centroid.x
        normalizedHotspot.y = centroid.y
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

const normalizeCounterGroups = (counterGroups, hotspots, fallbackToLegacyGroups = true) => {
  const hotspotIdSet = new Set((Array.isArray(hotspots) ? hotspots : []).map((hotspot) => hotspot.id))
  const sanitizeHotspotIds = (hotspotIds) => {
    if (!Array.isArray(hotspotIds)) return []
    const unique = new Set()
    hotspotIds.forEach((entry) => {
      const normalizedId = normalizeCounterGroupId(entry, "")
      if (!normalizedId || !hotspotIdSet.has(normalizedId)) return
      unique.add(normalizedId)
    })
    return Array.from(unique)
  }

  if (Array.isArray(counterGroups)) {
    const usedIds = new Set()
    return counterGroups
      .map((group, index) => {
        if (!group || typeof group !== "object") return null
        const baseId = normalizeCounterGroupId(group.id, `group_${index + 1}`)
        let id = baseId
        let suffix = 2
        while (usedIds.has(id)) {
          id = `${baseId}_${suffix}`
          suffix += 1
        }
        usedIds.add(id)
        return {
          id,
          label: normalizeString(group.label, id),
          showCounter: group.showCounter !== false,
          hotspotIds: sanitizeHotspotIds(group.hotspotIds),
        }
      })
      .filter(Boolean)
  }

  if (!fallbackToLegacyGroups) return []

  const groupsById = new Map()
  ;(Array.isArray(hotspots) ? hotspots : []).forEach((hotspot) => {
    const groupLabel = normalizeString(hotspot.group, "")
    if (!groupLabel) return
    const groupId = normalizeCounterGroupId(groupLabel, `group_${groupsById.size + 1}`)
    if (!groupsById.has(groupId)) {
      groupsById.set(groupId, {
        id: groupId,
        label: groupLabel,
        showCounter: true,
        hotspotIds: new Set(),
      })
    }
    groupsById.get(groupId).hotspotIds.add(hotspot.id)
  })

  return Array.from(groupsById.values()).map((group) => ({
    id: group.id,
    label: group.label,
    showCounter: group.showCounter,
    hotspotIds: Array.from(group.hotspotIds),
  }))
}

const clampSvgViewBoxMarginPercent = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return Math.min(20, numeric)
}

const ensureResponsiveSvg = (markup, viewBoxMarginPercent = 0) => {
  const input = typeof markup === "string" ? markup.trim() : ""
  if (!input) return ""
  if (!/<svg[\s>]/i.test(input)) return input

  const marginPercent = clampSvgViewBoxMarginPercent(viewBoxMarginPercent)

  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    if (/<svg[^>]*style\s*=/i.test(input)) return input
    return input.replace(
      /<svg\b/i,
      '<svg style="width:100%;height:auto;display:block;max-width:100%;"'
    )
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(input, "image/svg+xml")
    const svg = doc.querySelector("svg")
    if (!svg) return input

    const inlineStyle = normalizeString(svg.getAttribute("style"), "")
    if (!inlineStyle) {
      svg.setAttribute("style", "width:100%;height:auto;display:block;max-width:100%;")
    }

    if (marginPercent > 0) {
      const viewBoxRaw = normalizeString(svg.getAttribute("viewBox"), "")
      const viewBoxParts = viewBoxRaw.split(/[\s,]+/)
      const parsedViewBox = viewBoxParts.slice(0, 4).map((part) => Number(part))
      let vbX = Number.isFinite(parsedViewBox[0]) ? parsedViewBox[0] : 0
      let vbY = Number.isFinite(parsedViewBox[1]) ? parsedViewBox[1] : 0
      let vbWidth = Number.isFinite(parsedViewBox[2]) ? parsedViewBox[2] : null
      let vbHeight = Number.isFinite(parsedViewBox[3]) ? parsedViewBox[3] : null

      if (!(vbWidth > 0 && vbHeight > 0)) {
        const widthAttr = parseSvgNumber(svg.getAttribute("width"))
        const heightAttr = parseSvgNumber(svg.getAttribute("height"))
        if (Number.isFinite(widthAttr) && widthAttr > 0 && Number.isFinite(heightAttr) && heightAttr > 0) {
          vbX = 0
          vbY = 0
          vbWidth = widthAttr
          vbHeight = heightAttr
        }
      }

      if (vbWidth > 0 && vbHeight > 0) {
        const padX = (vbWidth * marginPercent) / 100
        const padY = (vbHeight * marginPercent) / 100
        svg.setAttribute(
          "viewBox",
          `${vbX - padX} ${vbY - padY} ${vbWidth + padX * 2} ${vbHeight + padY * 2}`
        )
      }
    }

    return new XMLSerializer().serializeToString(svg)
  } catch (error) {
    if (/<svg[^>]*style\s*=/i.test(input)) return input
    return input.replace(
      /<svg\b/i,
      '<svg style="width:100%;height:auto;display:block;max-width:100%;"'
    )
  }
}

const injectFieldFillValuesIntoSvg = (
  markup,
  numberFields,
  valuesByFieldId = {},
  viewBoxMarginPercent = 0
) => {
  const input = typeof markup === "string" ? markup.trim() : ""
  if (!input) return ""
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return ensureResponsiveSvg(input, viewBoxMarginPercent)
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(input, "image/svg+xml")
    const svg = doc.querySelector("svg")
    if (!svg) return ensureResponsiveSvg(input, viewBoxMarginPercent)

    const fields = Array.isArray(numberFields) ? numberFields : []
    fields.forEach((field) => {
      const textLayerId = normalizeString(field?.id, "")
      if (!textLayerId) return
      const target = doc.getElementById(textLayerId)
      if (!target || target.tagName.toLowerCase() !== "text") return
      target.setAttribute("text-anchor", "middle")
      const fieldId = normalizeString(field?.fieldId, "")
      const rawValue = fieldId ? valuesByFieldId[fieldId] : undefined
      const displayValue =
        rawValue == null || (typeof rawValue === "string" && rawValue.trim() === "")
          ? "#"
          : String(rawValue)
      const tspan = target.querySelector("tspan")
      if (tspan) {
        tspan.textContent = displayValue
      } else {
        target.textContent = displayValue
      }
    })

    const serialized = new XMLSerializer().serializeToString(svg)
    return ensureResponsiveSvg(serialized, viewBoxMarginPercent)
  } catch (error) {
    return ensureResponsiveSvg(input, viewBoxMarginPercent)
  }
}

const buildCountsByGroup = (selectedIds, hotspotsById, counterGroups = []) => {
  if (Array.isArray(counterGroups) && counterGroups.length > 0) {
    const counts = {}
    counterGroups.forEach((group) => {
      const groupId = normalizeString(group.id, "")
      if (!groupId) return
      const assignedHotspotIds = Array.isArray(group.hotspotIds) ? group.hotspotIds : []
      let count = 0
      assignedHotspotIds.forEach((hotspotId) => {
        if (!hotspotsById.has(hotspotId)) return
        if (selectedIds.has(hotspotId)) {
          count += 1
        }
      })
      counts[groupId] = count
    })
    return counts
  }

  const counts = {}
  selectedIds.forEach((id) => {
    const hotspot = hotspotsById.get(id)
    if (!hotspot) return
    const group = hotspot.group || "default"
    counts[group] = (counts[group] || 0) + 1
  })
  return counts
}

const buildMapValue = (
  selectedIds,
  hotspots,
  hotspotsById,
  counterGroups = [],
  annotations = []
) => {
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
    countsByGroup: buildCountsByGroup(selectedIds, hotspotsById, counterGroups),
    annotations,
    annotationCount: Array.isArray(annotations) ? annotations.length : 0,
    updatedAt: new Date().toISOString(),
  }
}

const createHotspotMapConfig = (config = {}) => {
  const markerSize =
    Number.isFinite(Number(config.markerSize)) && Number(config.markerSize) > 0
      ? Number(config.markerSize)
      : DEFAULT_MARKER_SIZE
  const interactionMode = resolveMapInteractionMode(config.interactionMode, config.enableAnnotations)
  const supportsAnnotations =
    interactionMode === "symbol" || interactionMode === "draw" || interactionMode === "symbol_draw"
  const hotspots = normalizeHotspots(config.hotspots, markerSize)
  const numberFields = normalizeNumberFields(config.numberFields)
  const annotationDefaultSymbol = normalizeAnnotationSymbol(
    config.annotationDefaultSymbol,
    DEFAULT_ANNOTATION_SYMBOL
  )
  const annotationSymbols = normalizeAnnotationSymbols(
    config.annotationSymbols,
    DEFAULT_ANNOTATION_SYMBOLS,
    annotationDefaultSymbol
  )
  const hasExplicitCounterGroups = Array.isArray(config.counterGroups)
  const counterGroups = normalizeCounterGroups(config.counterGroups, hotspots, !hasExplicitCounterGroups)

  return {
    imageUrl: normalizeString(config.imageUrl, ""),
    imageSvg: normalizeString(config.imageSvg, ""),
    imageAlt: normalizeString(config.imageAlt, "Map"),
    allowMultiSelect: config.allowMultiSelect !== false,
    showSummary: config.showSummary !== false,
    showDefaultCounter: config.showDefaultCounter !== false,
    showSelectedLabels: config.showSelectedLabels === true,
    showHotspotLabels: config.showHotspotLabels === true,
    totalCountLabel: normalizeString(config.totalCountLabel, "Selected"),
    openInModal: config.openInModal === true,
    modalButtonText: normalizeString(config.modalButtonText, "Open Map"),
    modalTitle: normalizeString(config.modalTitle, ""),
    modalMinWidth:
      Number.isFinite(Number(config.modalMinWidth)) && Number(config.modalMinWidth) > 0
        ? Math.max(360, Number(config.modalMinWidth))
        : 760,
    mapZoomPercent:
      Number.isFinite(Number(config.mapZoomPercent)) && Number(config.mapZoomPercent) > 0
        ? Math.max(25, Math.min(300, Number(config.mapZoomPercent)))
        : DEFAULT_MAP_ZOOM_PERCENT,
    mapWidthPercent:
      Number.isFinite(Number(config.mapWidthPercent)) && Number(config.mapWidthPercent) > 0
        ? Math.max(20, Math.min(100, Number(config.mapWidthPercent)))
        : DEFAULT_MAP_WIDTH_PERCENT,
    mapMaxWidth:
      Number.isFinite(Number(config.mapMaxWidth)) && Number(config.mapMaxWidth) > 0
        ? Math.max(220, Number(config.mapMaxWidth))
        : DEFAULT_MAP_MAX_WIDTH,
    mapMinHeight:
      Number.isFinite(Number(config.mapMinHeight)) && Number(config.mapMinHeight) > 0
        ? Math.max(120, Number(config.mapMinHeight))
        : DEFAULT_MAP_MIN_HEIGHT,
    mapPaddingPx:
      Number.isFinite(Number(config.mapPaddingPx)) && Number(config.mapPaddingPx) >= 0
        ? Math.max(0, Math.min(120, Number(config.mapPaddingPx)))
        : DEFAULT_MAP_PADDING_PX,
    mapMarginPx:
      Number.isFinite(Number(config.mapMarginPx)) && Number(config.mapMarginPx) >= 0
        ? Math.max(0, Math.min(120, Number(config.mapMarginPx)))
        : DEFAULT_MAP_MARGIN_PX,
    markerSize,
    interactionMode,
    enableAnnotations: supportsAnnotations,
    annotationDefaultSymbol: resolveAnnotationSymbol(
      annotationDefaultSymbol,
      DEFAULT_ANNOTATION_SYMBOL,
      annotationSymbols
    ),
    annotationSymbols,
    annotationDefaultColor: normalizeColor(config.annotationDefaultColor, DEFAULT_ANNOTATION_COLOR),
    annotationSizePercent:
      Number.isFinite(Number(config.annotationSizePercent)) && Number(config.annotationSizePercent) > 0
        ? Math.max(0.5, Math.min(20, Number(config.annotationSizePercent)))
        : DEFAULT_ANNOTATION_SIZE_PERCENT,
    numberFields,
    hotspots,
    counterGroups,
  }
}

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

    const widthAttr = parseSvgNumber(svg.getAttribute("width"))
    const heightAttr = parseSvgNumber(svg.getAttribute("height"))
    const sourceWidth = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : vbWidth || 100
    const sourceHeight = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : vbHeight || 100

    const toXPercent = (value) => clampPercent((Number(value) / sourceWidth) * 100)
    const toYPercent = (value) => clampPercent((Number(value) / sourceHeight) * 100)

    const elements = Array.from(
      svg.querySelectorAll("rect[data-hotspot-id], rect[id], circle[data-hotspot-id], circle[id], ellipse[data-hotspot-id], ellipse[id], polygon[data-hotspot-id], polygon[id], polyline[data-hotspot-id], polyline[id]")
    )

    return elements
      .map((element, index) => {
        const rawId = normalizeString(
          element.getAttribute("data-hotspot-id"),
          normalizeString(element.getAttribute("id"), `hotspot_${index + 1}`)
        )
        const rawLabel = normalizeString(element.getAttribute("data-hotspot-label"), rawId)
        const tagName = element.tagName.toLowerCase()

        if (tagName === "polygon" || tagName === "polyline") {
          const pointsAttr = normalizeString(element.getAttribute("points"), "")
          const points = pointsAttr
            .split(/\s+/)
            .map((entry) => {
              const pair = entry.split(",")
              if (pair.length < 2) return null
              return {
                x: toXPercent(pair[0]),
                y: toYPercent(pair[1]),
              }
            })
            .filter(Boolean)
          if (points.length < 3) return null
          const centroid = centroidFromPoints(points)
          return {
            id: rawId,
            label: rawLabel,
            shape: "polygon",
            x: centroid.x,
            y: centroid.y,
            points,
          }
        }

        if (tagName === "rect") {
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
        const r = tagName === "ellipse"
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
  showDefaultCounter = true,
  showSelectedLabels = false,
  showHotspotLabels = false,
  totalCountLabel = "Selected",
  counterGroups,
  openInModal = false,
  modalButtonText = "Open Map",
  modalTitle = "",
  modalMinWidth = 760,
  mapZoomPercent = DEFAULT_MAP_ZOOM_PERCENT,
  mapWidthPercent = DEFAULT_MAP_WIDTH_PERCENT,
  mapMaxWidth = DEFAULT_MAP_MAX_WIDTH,
  mapMinHeight = DEFAULT_MAP_MIN_HEIGHT,
  mapPaddingPx = DEFAULT_MAP_PADDING_PX,
  mapMarginPx = DEFAULT_MAP_MARGIN_PX,
  markerSize = DEFAULT_MARKER_SIZE,
  interactionMode,
  enableAnnotations = false,
  annotationDefaultSymbol = DEFAULT_ANNOTATION_SYMBOL,
  annotationSymbols = DEFAULT_ANNOTATION_SYMBOLS,
  annotationDefaultColor = DEFAULT_ANNOTATION_COLOR,
  annotationSizePercent = DEFAULT_ANNOTATION_SIZE_PERCENT,
  numberFields = [],
  totalCountFieldId,
  selectedIdsFieldId,
  selectedLabelsFieldId,
  required = false,
  readOnly = false,
}) => {
  const [fd] = useActiveData()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const resolvedInteractionMode = resolveMapInteractionMode(interactionMode, enableAnnotations)
  const supportsSelection = resolvedInteractionMode === "select"
  const supportsSymbolAnnotations =
    resolvedInteractionMode === "symbol" || resolvedInteractionMode === "symbol_draw"
  const supportsDrawAnnotations =
    resolvedInteractionMode === "draw" || resolvedInteractionMode === "symbol_draw"
  const supportsAnnotations = supportsSymbolAnnotations || supportsDrawAnnotations
  const resolvedAnnotationDefaultSymbol = normalizeAnnotationSymbol(annotationDefaultSymbol, DEFAULT_ANNOTATION_SYMBOL)
  const resolvedAnnotationSymbols = useMemo(
    () => normalizeAnnotationSymbols(annotationSymbols, DEFAULT_ANNOTATION_SYMBOLS, resolvedAnnotationDefaultSymbol),
    [annotationSymbols, resolvedAnnotationDefaultSymbol]
  )
  const [annotationTool, setAnnotationTool] = useState(
    supportsDrawAnnotations && !supportsSymbolAnnotations ? "draw" : "symbol"
  )
  const [annotationSymbol, setAnnotationSymbol] = useState(
    resolveAnnotationSymbol(resolvedAnnotationDefaultSymbol, resolvedAnnotationDefaultSymbol, resolvedAnnotationSymbols)
  )
  const [draftStrokePoints, setDraftStrokePoints] = useState([])
  const drawingPointerIdRef = useRef(null)
  const drawingPointsRef = useRef([])
  const isDrawingRef = useRef(false)
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false
  const hasSvgBackground = /<svg[\s>]/i.test(typeof imageSvg === "string" ? imageSvg : "")
  const svgViewBoxMarginPercent = hasSvgBackground ? DEFAULT_SVG_VIEWBOX_MARGIN_PERCENT : 0
  const svgViewBoxRenderSize = 100 + svgViewBoxMarginPercent * 2
  const overlayViewBox =
    svgViewBoxMarginPercent > 0
      ? `${-svgViewBoxMarginPercent} ${-svgViewBoxMarginPercent} ${svgViewBoxRenderSize} ${svgViewBoxRenderSize}`
      : "0 0 100 100"
  const projectMapPercentToRenderPercent = (value) => {
    const clamped = clampPercent(value)
    if (svgViewBoxMarginPercent <= 0) return clamped
    return clampPercent(((clamped + svgViewBoxMarginPercent) * 100) / svgViewBoxRenderSize)
  }
  const projectRenderPercentToMapPercent = (value) => {
    const clamped = clampPercent(value)
    if (svgViewBoxMarginPercent <= 0) return clamped
    return clampPercent((clamped * svgViewBoxRenderSize) / 100 - svgViewBoxMarginPercent)
  }
  const projectMapLengthToRenderPercent = (value) => {
    const numeric = Number(value)
    const clamped = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0
    if (svgViewBoxMarginPercent <= 0) return clamped
    return Math.max(0, Math.min(100, (clamped * 100) / svgViewBoxRenderSize))
  }

  const normalizedHotspots = useMemo(
    () => normalizeHotspots(hotspots, markerSize),
    [hotspots, markerSize]
  )
  const hotspotsById = useMemo(() => {
    const map = new Map()
    normalizedHotspots.forEach((hotspot) => map.set(hotspot.id, hotspot))
    return map
  }, [normalizedHotspots])
  const normalizedCounterGroups = useMemo(
    () => normalizeCounterGroups(counterGroups, normalizedHotspots, !Array.isArray(counterGroups)),
    [counterGroups, normalizedHotspots]
  )
  const normalizedNumberFields = useMemo(
    () => normalizeNumberFields(numberFields),
    [numberFields]
  )
  const fieldFillValueMap = useMemo(() => {
    const map = {}
    normalizedNumberFields.forEach((numberField) => {
      if (!numberField?.fieldId) return
      const value = fd?.field?.data?.[numberField.fieldId]
      if (value == null) return
      if (typeof value === "number") {
        if (Number.isFinite(value)) {
          map[numberField.fieldId] = String(value)
        }
        return
      }
      if (typeof value === "string") {
        map[numberField.fieldId] = value
        return
      }
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        map[numberField.fieldId] = String(parsed)
      }
    })
    return map
  }, [fd?.field?.data, normalizedNumberFields])

  const mapValue = fd?.field?.data?.[fieldId]
  const selectedIds = useMemo(() => {
    if (!Array.isArray(mapValue?.selectedIds)) return new Set()
    return new Set(
      mapValue.selectedIds
        .map((value) => normalizeString(value, ""))
        .filter((value) => value.length > 0)
    )
  }, [mapValue])
  const resolvedAnnotationDefaultColor = normalizeColor(annotationDefaultColor, DEFAULT_ANNOTATION_COLOR)
  const resolvedAnnotationSizePercent =
    Number.isFinite(Number(annotationSizePercent)) && Number(annotationSizePercent) > 0
      ? Math.max(0.5, Math.min(20, Number(annotationSizePercent)))
      : DEFAULT_ANNOTATION_SIZE_PERCENT
  const annotations = useMemo(
    () =>
      normalizeAnnotations(
        mapValue?.annotations,
        resolvedAnnotationDefaultSymbol,
        resolvedAnnotationDefaultColor,
        resolvedAnnotationSizePercent,
        resolvedAnnotationSymbols
      ),
    [
      mapValue?.annotations,
      resolvedAnnotationDefaultColor,
      resolvedAnnotationDefaultSymbol,
      resolvedAnnotationSizePercent,
      resolvedAnnotationSymbols,
    ]
  )
  const isSymbolModeActive = supportsSymbolAnnotations && (supportsDrawAnnotations ? annotationTool === "symbol" : true)
  const isDrawModeActive = supportsDrawAnnotations && (supportsSymbolAnnotations ? annotationTool === "draw" : true)

  useEffect(() => {
    if (supportsDrawAnnotations && !supportsSymbolAnnotations && annotationTool !== "draw") {
      setAnnotationTool("draw")
      return
    }
    if (supportsSymbolAnnotations && !supportsDrawAnnotations && annotationTool !== "symbol") {
      setAnnotationTool("symbol")
    }
  }, [annotationTool, supportsDrawAnnotations, supportsSymbolAnnotations])

  useEffect(() => {
    const nextSymbol = resolveAnnotationSymbol(
      annotationSymbol,
      resolvedAnnotationDefaultSymbol,
      resolvedAnnotationSymbols
    )
    if (nextSymbol !== annotationSymbol) {
      setAnnotationSymbol(nextSymbol)
    }
  }, [annotationSymbol, resolvedAnnotationDefaultSymbol, resolvedAnnotationSymbols])

  useEffect(() => {
    if (!isDrawModeActive) {
      isDrawingRef.current = false
      drawingPointerIdRef.current = null
      drawingPointsRef.current = []
      if (draftStrokePoints.length > 0) {
        setDraftStrokePoints([])
      }
    }
  }, [draftStrokePoints.length, isDrawModeActive])

  const commitMapState = useCallback((nextSelectedIds, nextAnnotations) => {
    if (!fieldId || !fd?.setFormData) return

    const normalizedAnnotations = normalizeAnnotations(
      nextAnnotations,
      resolvedAnnotationDefaultSymbol,
      resolvedAnnotationDefaultColor,
      resolvedAnnotationSizePercent,
      resolvedAnnotationSymbols
    )
    const value = buildMapValue(
      nextSelectedIds,
      normalizedHotspots,
      hotspotsById,
      normalizedCounterGroups,
      normalizedAnnotations
    )
    const hasSelections = value.selectedCount > 0
    const hasAnnotations = normalizedAnnotations.length > 0
    const hasMapData = hasSelections || hasAnnotations
    const selectedIdsCsv = value.selectedIds.join(",")
    const selectedLabelsCsv = value.selectedLabels.join(", ")

    fd.setFormData(
      produce((draft) => {
        if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
        if (!draft.field.data) draft.field.data = {}
        draft.field.data[fieldId] = hasMapData ? value : null

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
    normalizedCounterGroups,
    hotspotsById,
    resolvedAnnotationDefaultColor,
    resolvedAnnotationDefaultSymbol,
    resolvedAnnotationSymbols,
    resolvedAnnotationSizePercent,
    selectedIdsFieldId,
    selectedLabelsFieldId,
    totalCountFieldId,
  ])

  const commitSelection = useCallback((nextSelectedIds) => {
    commitMapState(nextSelectedIds, annotations)
  }, [annotations, commitMapState])

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

  const handleHotspotKeyDown = useCallback((event, hotspotId) => {
    if (readOnly) return
    if (!supportsSelection) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleToggleHotspot(hotspotId)
    }
  }, [handleToggleHotspot, readOnly, supportsSelection])

  const getPointFromEvent = useCallback((event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null
    const x = projectRenderPercentToMapPercent(((event.clientX - bounds.left) / bounds.width) * 100)
    const y = projectRenderPercentToMapPercent(((event.clientY - bounds.top) / bounds.height) * 100)
    return { x, y }
  }, [projectRenderPercentToMapPercent])

  const handleAddAnnotation = useCallback((event) => {
    if (readOnly || !supportsAnnotations || !isSymbolModeActive) return
    const point = getPointFromEvent(event)
    if (!point) return
    const nextAnnotations = [
      ...annotations,
      {
        id: `annotation_${Date.now()}_${annotations.length + 1}`,
        type: "symbol",
        x: point.x,
        y: point.y,
        symbol: resolveAnnotationSymbol(
          annotationSymbol,
          resolvedAnnotationDefaultSymbol,
          resolvedAnnotationSymbols
        ),
        color: resolvedAnnotationDefaultColor,
        size: resolvedAnnotationSizePercent,
      },
    ]
    commitMapState(new Set(selectedIds), nextAnnotations)
  }, [
    annotationSymbol,
    annotations,
    commitMapState,
    getPointFromEvent,
    isSymbolModeActive,
    readOnly,
    resolvedAnnotationDefaultColor,
    resolvedAnnotationDefaultSymbol,
    resolvedAnnotationSymbols,
    resolvedAnnotationSizePercent,
    selectedIds,
    supportsAnnotations,
  ])

  const handleDrawPointerDown = useCallback((event) => {
    if (readOnly || !isDrawModeActive || !supportsAnnotations) return
    if (typeof event.button === "number" && event.button !== 0) return
    const point = getPointFromEvent(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    if (typeof event.currentTarget.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch (error) {
        // no-op
      }
    }
    drawingPointerIdRef.current = event.pointerId
    drawingPointsRef.current = [point]
    isDrawingRef.current = true
    setDraftStrokePoints([point])
  }, [getPointFromEvent, isDrawModeActive, readOnly, supportsAnnotations])

  const handleDrawPointerMove = useCallback((event) => {
    if (!isDrawingRef.current || !isDrawModeActive) return
    if (drawingPointerIdRef.current !== null && event.pointerId !== drawingPointerIdRef.current) return
    const point = getPointFromEvent(event)
    if (!point) return
    const previous = drawingPointsRef.current[drawingPointsRef.current.length - 1]
    if (previous) {
      const deltaX = Math.abs(previous.x - point.x)
      const deltaY = Math.abs(previous.y - point.y)
      if (deltaX < 0.08 && deltaY < 0.08) return
    }
    const nextPoints = [...drawingPointsRef.current, point]
    drawingPointsRef.current = nextPoints
    setDraftStrokePoints(nextPoints)
    event.preventDefault()
    event.stopPropagation()
  }, [getPointFromEvent, isDrawModeActive])

  const handleDrawPointerUp = useCallback((event) => {
    if (!isDrawingRef.current) return
    if (drawingPointerIdRef.current !== null && event.pointerId !== drawingPointerIdRef.current) return
    if (typeof event.currentTarget.releasePointerCapture === "function") {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch (error) {
        // no-op
      }
    }
    event.preventDefault()
    event.stopPropagation()

    isDrawingRef.current = false
    drawingPointerIdRef.current = null
    const points = drawingPointsRef.current
    drawingPointsRef.current = []
    setDraftStrokePoints([])

    if (!supportsAnnotations || !isDrawModeActive || readOnly) return
    if (!Array.isArray(points) || points.length < 2) return

    const nextAnnotations = [
      ...annotations,
      {
        id: `annotation_${Date.now()}_${annotations.length + 1}`,
        type: "stroke",
        points,
        color: resolvedAnnotationDefaultColor,
        size: resolvedAnnotationSizePercent,
      },
    ]
    commitMapState(new Set(selectedIds), nextAnnotations)
  }, [
    annotations,
    commitMapState,
    isDrawModeActive,
    readOnly,
    resolvedAnnotationDefaultColor,
    resolvedAnnotationSizePercent,
    selectedIds,
    supportsAnnotations,
  ])

  const getNumberFieldValue = useCallback((numberField) => {
    const value = fd?.field?.data?.[numberField.fieldId]
    if (value == null) return ""
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : ""
    }
    if (typeof value === "string") return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? String(parsed) : ""
  }, [fd])

  const handleNumberFieldChange = useCallback((numberField, rawValue) => {
    if (readOnly || !fd?.setFormData || !numberField?.fieldId) return
    const normalizedRaw = typeof rawValue === "string" ? rawValue : String(rawValue ?? "")
    const trimmed = normalizedRaw.trim()
    let nextValue = null
    if (trimmed) {
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed)) {
        let normalizedNumeric = parsed
        if (typeof numberField.min === "number") {
          normalizedNumeric = Math.max(numberField.min, normalizedNumeric)
        }
        if (typeof numberField.max === "number") {
          normalizedNumeric = Math.min(numberField.max, normalizedNumeric)
        }
        nextValue = normalizedNumeric
      } else {
        nextValue = normalizedRaw
      }
    }
    fd.setFormData(
      produce((draft) => {
        if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
        if (!draft.field.data) draft.field.data = {}
        draft.field.data[numberField.fieldId] = nextValue
      })
    )
  }, [fd, readOnly])

  const isFieldFillMode = resolvedInteractionMode === "field_fill"
  const fieldFillTextLayerIdSet = useMemo(() => {
    const ids = new Set()
    if (!isFieldFillMode || typeof DOMParser === "undefined") return ids
    const markup = typeof imageSvg === "string" ? imageSvg.trim() : ""
    if (!markup) return ids
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(markup, "image/svg+xml")
      Array.from(doc.querySelectorAll("text[id]")).forEach((element) => {
        const id = normalizeString(element.getAttribute("id"), "")
        if (id) ids.add(id)
      })
    } catch (error) {
      return ids
    }
    return ids
  }, [imageSvg, isFieldFillMode])
  const responsiveSvg = useMemo(() => {
    if (isFieldFillMode && normalizedNumberFields.length > 0) {
      return injectFieldFillValuesIntoSvg(
        imageSvg,
        normalizedNumberFields,
        fieldFillValueMap,
        svgViewBoxMarginPercent
      )
    }
    return ensureResponsiveSvg(imageSvg, svgViewBoxMarginPercent)
  }, [
    fieldFillValueMap,
    imageSvg,
    isFieldFillMode,
    normalizedNumberFields,
    svgViewBoxMarginPercent,
  ])
  const selectedLabels = Array.isArray(mapValue?.selectedLabels) ? mapValue.selectedLabels : []
  const selectedCount = Number.isFinite(mapValue?.selectedCount) ? mapValue.selectedCount : selectedIds.size
  const countsByGroup = useMemo(() => {
    if (mapValue?.countsByGroup && typeof mapValue.countsByGroup === "object") {
      return mapValue.countsByGroup
    }
    return buildCountsByGroup(selectedIds, hotspotsById, normalizedCounterGroups)
  }, [hotspotsById, mapValue?.countsByGroup, normalizedCounterGroups, selectedIds])
  const summaryGroups = useMemo(() => {
    if (normalizedCounterGroups.length > 0) {
      return normalizedCounterGroups
        .filter((group) => group.showCounter !== false)
        .map((group) => ({
          id: group.id,
          label: normalizeString(group.label, group.id),
        }))
    }
    const names = new Set()
    normalizedHotspots.forEach((hotspot) => {
      const group = normalizeString(hotspot.group, "")
      if (group) names.add(group)
    })
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((groupName) => ({ id: groupName, label: groupName }))
  }, [normalizedCounterGroups, normalizedHotspots])
  const resolvedMapZoomPercent = Math.max(25, Math.min(300, Number(mapZoomPercent) || DEFAULT_MAP_ZOOM_PERCENT))
  const zoomFactor = resolvedMapZoomPercent / 100
  const resolvedMapWidthPercent = Math.max(20, Math.min(100, Number(mapWidthPercent) || DEFAULT_MAP_WIDTH_PERCENT))
  const resolvedMapMaxWidth = Math.max(220, Number(mapMaxWidth) || DEFAULT_MAP_MAX_WIDTH)
  const resolvedMapMinHeight = Math.max(120, Number(mapMinHeight) || DEFAULT_MAP_MIN_HEIGHT)
  const resolvedMapPaddingPx = Math.max(0, Math.min(120, Number(mapPaddingPx) || DEFAULT_MAP_PADDING_PX))
  const resolvedMapMarginPx = Math.max(0, Math.min(120, Number(mapMarginPx) || DEFAULT_MAP_MARGIN_PX))
  const resolvedModalMinWidth = Math.max(360, Number(modalMinWidth) || 760)

  const panelStyle = {
    border: `1px solid ${isDarkMode ? "#404040" : "#d0d7de"}`,
    borderRadius: "8px",
    backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
    padding: `${resolvedMapPaddingPx}px`,
  }

  const mapFrameStyle = {
    position: "relative",
    width: `${resolvedMapWidthPercent}%`,
    maxWidth: `${resolvedMapMaxWidth * zoomFactor}px`,
    minHeight: `${resolvedMapMinHeight * zoomFactor}px`,
    margin: `${resolvedMapMarginPx}px auto`,
    borderRadius: "6px",
    overflow: "hidden",
    border: `1px solid ${isDarkMode ? "#333333" : "#e0e0e0"}`,
    backgroundColor: isDarkMode ? "#171717" : "#fafafa",
    cursor: supportsAnnotations && !readOnly ? "crosshair" : "default",
  }

  const overlayStyle = {
    position: "absolute",
    inset: 0,
  }

  const renderMapFrame = () => (
    <div
      style={mapFrameStyle}
      onClick={handleAddAnnotation}
      onPointerDown={handleDrawPointerDown}
      onPointerMove={handleDrawPointerMove}
      onPointerUp={handleDrawPointerUp}
      onPointerCancel={handleDrawPointerUp}
    >
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
            minHeight: `${resolvedMapMinHeight}px`,
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
        <svg
          viewBox={overlayViewBox}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          {normalizedHotspots.map((hotspot) => {
            const isSelected = selectedIds.has(hotspot.id)
            const stroke = isSelected ? "#1d4ed8" : "#374151"
            const fill = isSelected ? "rgba(37, 99, 235, 0.4)" : "rgba(255, 255, 255, 0.2)"
            const labelAnchor = getHotspotLabelAnchor(hotspot)

            return (
              <g
                key={hotspot.id}
                role={supportsSelection ? "button" : undefined}
                tabIndex={readOnly || !supportsSelection ? -1 : 0}
                aria-pressed={supportsSelection ? isSelected : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!supportsSelection) return
                  handleToggleHotspot(hotspot.id)
                }}
                onKeyDown={(event) => handleHotspotKeyDown(event, hotspot.id)}
                style={{
                  cursor: readOnly ? "default" : supportsSelection ? "pointer" : supportsAnnotations ? "crosshair" : "default",
                  outline: "none",
                }}
              >
                <title>{hotspot.label || hotspot.id}</title>
                {hotspot.shape === "circle" ? (
                  <circle
                    cx={hotspot.x}
                    cy={hotspot.y}
                    r={Math.max(0.5, hotspot.radius)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={0.5}
                  />
                ) : hotspot.shape === "polygon" ? (
                  <polygon
                    points={pointsToSvgString(hotspot.points)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={0.5}
                  />
                ) : (
                  <rect
                    x={hotspot.x}
                    y={hotspot.y}
                    width={Math.max(0.5, hotspot.width)}
                    height={Math.max(0.5, hotspot.height)}
                    rx={0.5}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={0.5}
                  />
                )}
                {showHotspotLabels ? (
                  <text
                    x={labelAnchor.x}
                    y={labelAnchor.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: "2.2px",
                      fontWeight: 700,
                      fill: isSelected ? "#0f172a" : "#1f2937",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {hotspot.label || hotspot.id}
                  </text>
                ) : null}
              </g>
            )
          })}
          {supportsAnnotations ? annotations.map((annotation) => {
            const size = Math.max(0.5, Number(annotation.size) || resolvedAnnotationSizePercent)
            const strokeWidth = Math.max(0.35, size / 4.5)
            const stroke = normalizeColor(annotation.color, resolvedAnnotationDefaultColor)
            if (annotation.type === "stroke") {
              return (
                <polyline
                  key={annotation.id}
                  points={annotationPointsToSvgString(annotation.points)}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )
            }
            const half = size / 2
            if (annotation.symbol === "circle") {
              return (
                <circle
                  key={annotation.id}
                  cx={annotation.x}
                  cy={annotation.y}
                  r={half}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  pointerEvents="none"
                />
              )
            }
            if (annotation.symbol === "triangle") {
              return (
                <polygon
                  key={annotation.id}
                  points={`${annotation.x},${annotation.y - half} ${annotation.x - half},${annotation.y + half} ${annotation.x + half},${annotation.y + half}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )
            }
            return (
              <g key={annotation.id} pointerEvents="none">
                <line
                  x1={annotation.x - half}
                  y1={annotation.y - half}
                  x2={annotation.x + half}
                  y2={annotation.y + half}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
                <line
                  x1={annotation.x + half}
                  y1={annotation.y - half}
                  x2={annotation.x - half}
                  y2={annotation.y + half}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
              </g>
            )
          }) : null}
          {isDrawModeActive && draftStrokePoints.length > 1 ? (
            <polyline
              points={annotationPointsToSvgString(draftStrokePoints)}
              fill="none"
              stroke={resolvedAnnotationDefaultColor}
              strokeWidth={Math.max(0.35, resolvedAnnotationSizePercent / 4.5)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
              pointerEvents="none"
            />
          ) : null}
        </svg>
      </div>
      {normalizedNumberFields.length > 0 ? (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {normalizedNumberFields.map((numberField) => {
            const useSvgLayerTakeover = isFieldFillMode && fieldFillTextLayerIdSet.has(numberField.id)
            const renderedX = projectMapPercentToRenderPercent(numberField.x)
            const renderedY = projectMapPercentToRenderPercent(numberField.y)
            const renderedWidth = projectMapLengthToRenderPercent(numberField.width)
            return (
              <div
                key={numberField.id}
                style={{
                  position: "absolute",
                  left: `${renderedX}%`,
                  top: `${renderedY}%`,
                  transform: "translate(-50%, -50%)",
                  width: `${renderedWidth}%`,
                  minWidth: useSvgLayerTakeover ? "20px" : "56px",
                  maxWidth: useSvgLayerTakeover ? "180px" : "220px",
                  pointerEvents: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                {numberField.label && !useSvgLayerTakeover ? (
                  <span
                    style={{
                      fontSize: "10px",
                      lineHeight: 1.1,
                      color: isDarkMode ? "#d1d5db" : "#334155",
                      textShadow: isDarkMode ? "none" : "0 0 2px rgba(255,255,255,0.7)",
                    }}
                  >
                    {numberField.label}
                  </span>
                ) : null}
                <input
                  type={useSvgLayerTakeover ? "text" : "number"}
                  inputMode="decimal"
                  value={getNumberFieldValue(numberField)}
                  onChange={(event) => handleNumberFieldChange(numberField, event.target.value)}
                  min={numberField.min}
                  max={numberField.max}
                  step={numberField.step}
                  placeholder={numberField.placeholder || undefined}
                  disabled={readOnly}
                  style={{
                    width: "100%",
                    borderRadius: useSvgLayerTakeover ? "0" : "4px",
                    border: useSvgLayerTakeover ? "none" : `1px solid ${isDarkMode ? "#4b5563" : "#cbd5e1"}`,
                    padding: useSvgLayerTakeover ? "0" : "3px 6px",
                    fontSize: useSvgLayerTakeover ? "14px" : "12px",
                    fontWeight: useSvgLayerTakeover ? 700 : 400,
                    textAlign: "center",
                    background: useSvgLayerTakeover ? "transparent" : isDarkMode ? "#111827" : "#ffffff",
                    color: useSvgLayerTakeover ? "transparent" : isDarkMode ? "#f3f4f6" : "#111827",
                    caretColor: useSvgLayerTakeover ? (isDarkMode ? "#f3f4f6" : "#111827") : undefined,
                    outline: "none",
                  }}
                />
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )

  const renderSummary = () => {
    if (!showSummary) return null
    return (
      <Stack tokens={{ childrenGap: 4 }}>
        {showDefaultCounter && !isFieldFillMode ? (
          <Text variant="small">
            {totalCountLabel || "Selected"}: <strong>{selectedCount}</strong>
          </Text>
        ) : null}
        {summaryGroups.map((group) => (
          <Text
            key={group.id}
            variant="small"
            styles={{ root: { fontSize: "11px", color: isDarkMode ? "#d1d5db" : "#4b5563" } }}
          >
            {group.label}: <strong>{Number(countsByGroup[group.id] || 0)}</strong>
          </Text>
        ))}
        {supportsAnnotations ? (
          <Text
            variant="small"
            styles={{ root: { fontSize: "11px", color: isDarkMode ? "#d1d5db" : "#4b5563" } }}
          >
            Annotations: <strong>{annotations.length}</strong>
          </Text>
        ) : null}
        {showSelectedLabels && selectedLabels.length > 0 && (
          <Text variant="small" styles={{ root: { fontSize: "11px", color: isDarkMode ? "#d1d5db" : "#4b5563" } }}>
            {selectedLabels.join(", ")}
          </Text>
        )}
      </Stack>
    )
  }

  const renderAnnotationModeControls = () => {
    if (!supportsAnnotations) return null
    const showToolToggle = supportsSymbolAnnotations && supportsDrawAnnotations
    const showSymbolPicker = supportsSymbolAnnotations && resolvedAnnotationSymbols.length > 1
    if (!showToolToggle && !showSymbolPicker) return null

    return (
      <Stack horizontal wrap verticalAlign="end" tokens={{ childrenGap: 10 }}>
        {showToolToggle ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "11px" }}>
            <span>Tool</span>
            <select
              value={annotationTool}
              onChange={(event) => setAnnotationTool(event.target.value === "draw" ? "draw" : "symbol")}
              disabled={readOnly}
              style={{
                minWidth: "110px",
                borderRadius: "4px",
                border: `1px solid ${isDarkMode ? "#4b5563" : "#cbd5e1"}`,
                padding: "4px 6px",
                background: isDarkMode ? "#111827" : "#ffffff",
                color: isDarkMode ? "#f3f4f6" : "#111827",
              }}
            >
              <option value="symbol">Symbol</option>
              <option value="draw">Draw</option>
            </select>
          </label>
        ) : null}
        {showSymbolPicker ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "11px" }}>
            <span>Symbol</span>
            <select
              value={annotationSymbol}
              onChange={(event) =>
                setAnnotationSymbol(
                  resolveAnnotationSymbol(
                    event.target.value,
                    resolvedAnnotationDefaultSymbol,
                    resolvedAnnotationSymbols
                  )
                )
              }
              disabled={readOnly}
              style={{
                minWidth: "92px",
                borderRadius: "4px",
                border: `1px solid ${isDarkMode ? "#4b5563" : "#cbd5e1"}`,
                padding: "4px 6px",
                background: isDarkMode ? "#111827" : "#ffffff",
                color: isDarkMode ? "#f3f4f6" : "#111827",
              }}
            >
              {resolvedAnnotationSymbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {ANNOTATION_SYMBOL_LABELS[symbol] || symbol}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </Stack>
    )
  }

  return (
    <Stack tokens={{ childrenGap: 8 }} style={panelStyle}>
      {label && (
        <Label required={required} styles={{ root: { marginBottom: 0 } }}>
          {label}
        </Label>
      )}
      {openInModal ? (
        <>
          <PrimaryButton
            text={modalButtonText || "Open Map"}
            onClick={() => setIsModalOpen(true)}
            disabled={readOnly && normalizedHotspots.length === 0}
          />
          {renderSummary()}
          <Dialog
            hidden={!isModalOpen}
            onDismiss={() => setIsModalOpen(false)}
            dialogContentProps={{
              type: DialogType.largeHeader,
              title: modalTitle || label || "Map Selection",
            }}
            modalProps={{
              isBlocking: false,
              styles: {
                main: {
                  minWidth: `${resolvedModalMinWidth}px`,
                  maxWidth: "92vw",
                },
              },
            }}
          >
            <Stack tokens={{ childrenGap: 10 }}>
              {renderAnnotationModeControls()}
              {renderMapFrame()}
              {renderSummary()}
            </Stack>
            <DialogFooter>
              <PrimaryButton text="Done" onClick={() => setIsModalOpen(false)} />
            </DialogFooter>
          </Dialog>
        </>
      ) : (
        <>
          {renderAnnotationModeControls()}
          {renderMapFrame()}
          {renderSummary()}
        </>
      )}
    </Stack>
  )
}

HotspotMapField.createConfig = createHotspotMapConfig
HotspotMapField.importSvgHotspots = importSvgHotspots
HotspotMapField.normalizeHotspots = normalizeHotspots
