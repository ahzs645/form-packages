// Generated from lib/drawer/*.ts and scripts/templates/drawer-diagram-field.jsx by scripts/generate-drawer-diagram.mjs.
"use strict";
var DrawerRuntime = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // lib/drawer/runtime.ts
  var runtime_exports = {};
  __export(runtime_exports, {
    DEFAULT_SELECTED_COLOR: () => DEFAULT_SELECTED_COLOR,
    HOTSPOT_IMAGE_ID: () => HOTSPOT_IMAGE_ID,
    annotationsToMarks: () => annotationsToMarks,
    areasAtPoint: () => areasAtPoint,
    buildDrawerDiagramValue: () => buildDrawerDiagramValue,
    countedGroups: () => countedGroups,
    drawerMarkerCounts: () => drawerMarkerCounts,
    drawerSites: () => drawerSites,
    findImage: () => findImage,
    getView: () => getView,
    hotspotSurface: () => hotspotSurface,
    imageScale: () => imageScale,
    normalizeNumberFields: () => normalizeNumberFields,
    normalizeValueOptions: () => normalizeValueOptions,
    pageToImage: () => pageToImage,
    readDrawerAnswers: () => readDrawerAnswers,
    readDrawerSiteAnswers: () => readDrawerSiteAnswers,
    renderDrawerSvg: () => renderDrawerSvg,
    toDrawerDoc: () => toDrawerDoc,
    toHotspotValue: () => toHotspotValue
  });

  // vendor/drawer/src/types.ts
  var DEFAULT_STYLE = {
    balloonShape: "none",
    leaderStyle: "elbow",
    anchorMarker: "ring",
    leaderEnd: "none",
    dashed: false,
    leaderWidth: 1.6,
    fontWeight: 500
  };

  // vendor/drawer/src/geometry.ts
  var own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function boxForTarget(base, targetId) {
    if (targetId && own(base.targetBoxes ?? {}, targetId)) return base.targetBoxes[targetId];
    return base.contentBox;
  }
  function findImage(doc, id) {
    return id ? doc.images.find((i) => i.id === id) : void 0;
  }
  function isImageVisible(doc, imageId) {
    if (!imageId) return true;
    const image = findImage(doc, imageId);
    return !!image && image.visible !== false;
  }
  function imageToPage(image, p) {
    const vb = image.drawing.viewBox;
    const sx = image.width / vb.w * (image.flipX ? -1 : 1);
    const sy = image.height / vb.h;
    const dx = (p.x - vb.x - vb.w / 2) * sx;
    const dy = (p.y - vb.y - vb.h / 2) * sy;
    const r = image.rotation * Math.PI / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return {
      x: image.x + image.width / 2 + dx * c - dy * s,
      y: image.y + image.height / 2 + dx * s + dy * c
    };
  }
  function pageToImage(image, p) {
    const vb = image.drawing.viewBox;
    const r = -image.rotation * Math.PI / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const ox = p.x - image.x - image.width / 2;
    const oy = p.y - image.y - image.height / 2;
    const dx = ox * c - oy * s;
    const dy = ox * s + oy * c;
    const sx = image.width / vb.w * (image.flipX ? -1 : 1);
    const sy = image.height / vb.h;
    return { x: dx / sx + vb.x + vb.w / 2, y: dy / sy + vb.y + vb.h / 2 };
  }
  function imageTransform(image) {
    const vb = image.drawing.viewBox;
    const sx = image.width / vb.w * (image.flipX ? -1 : 1);
    const sy = image.height / vb.h;
    return `translate(${round(image.x + image.width / 2)} ${round(image.y + image.height / 2)}) rotate(${round(image.rotation)}) scale(${roundScale(sx)} ${roundScale(sy)}) translate(${round(-(vb.x + vb.w / 2))} ${round(-(vb.y + vb.h / 2))})`;
  }
  function imageBoxCorners(image, box2 = image.drawing.viewBox) {
    return [
      { x: box2.x, y: box2.y },
      { x: box2.x + box2.w, y: box2.y },
      { x: box2.x + box2.w, y: box2.y + box2.h },
      { x: box2.x, y: box2.y + box2.h }
    ].map((p) => imageToPage(image, p));
  }
  function boundsOfPoints(points) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  function imagePageBounds(image, box2 = image.drawing.viewBox) {
    return boundsOfPoints(imageBoxCorners(image, box2));
  }
  function docContentBox(doc) {
    const boxes = doc.images.filter((i) => i.visible !== false).map((i) => imagePageBounds(i, i.drawing.contentBox));
    if (doc.base.inner.trim() || boxes.length === 0) boxes.push(doc.base.contentBox);
    const points = boxes.flatMap((b) => [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y + b.h }
    ]);
    return boundsOfPoints(points);
  }
  function anchorPagePoint(doc, anchor) {
    const image = findImage(doc, anchor.imageId);
    const drawing = image?.drawing ?? doc.base;
    const local = resolveAnchor(anchor, boxForTarget(drawing, anchor.relative?.targetId ?? null));
    return image ? imageToPage(image, local) : local;
  }
  function resolveAnchor(anchor, contentBox) {
    switch (anchor.mode) {
      case "absolute":
        return anchor.absolute ?? { x: 0, y: 0 };
      case "relative-bbox": {
        const r = anchor.relative;
        if (!r) return { x: 0, y: 0 };
        return {
          x: contentBox.x + r.nx * contentBox.w,
          y: contentBox.y + r.ny * contentBox.h
        };
      }
      case "path-offset":
        return { x: 0, y: 0 };
    }
  }
  function pointToNormalized(p, contentBox) {
    return {
      nx: contentBox.w ? (p.x - contentBox.x) / contentBox.w : 0,
      ny: contentBox.h ? (p.y - contentBox.y) / contentBox.h : 0
    };
  }
  function fontSizeFor(box2) {
    const s = Math.max(box2.w, box2.h) * 0.02;
    return Math.min(30, Math.max(11, Math.round(s)));
  }
  function balloonRadius(text3, shape, fontSize = 14) {
    if (shape === "none") return Math.max(4, fontSize * 0.3);
    const base = fontSize * 0.95;
    const extra = Math.max(0, text3.length - 2) * fontSize * 0.36;
    return base + extra;
  }
  var SHOULDER_LEN = 14;
  function buildLeader(c, fontSize = 14) {
    const center = c.labelPos;
    const anchor = c.anchorPoint;
    const radius = balloonRadius(c.balloonText, c.balloonShape, fontSize);
    const side = anchor.x <= center.x ? "left" : "right";
    if (c.leaderStyle === "none") return { points: [], balloonCenter: center, radius, side };
    if (c.leaderStyle === "straight") {
      const dx = anchor.x - center.x;
      const dy = anchor.y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      const edge = {
        x: center.x + dx / len * radius,
        y: center.y + dy / len * radius
      };
      return { points: [anchor, edge], balloonCenter: center, radius, side };
    }
    const sign = side === "left" ? -1 : 1;
    const landing = { x: center.x + sign * radius, y: center.y };
    const shoulder = { x: landing.x + sign * SHOULDER_LEN, y: landing.y };
    const bend = c.elbow ?? shoulder;
    const points = c.elbow ? [anchor, c.elbow, landing] : [anchor, bend, landing];
    return { points, balloonCenter: center, radius, side };
  }
  function labelTextPlacement(c, geo) {
    if (c.labelOffset) {
      return {
        x: c.labelPos.x + c.labelOffset.x,
        y: c.labelPos.y + c.labelOffset.y,
        anchor: c.labelAlign ?? (geo.side === "left" ? "start" : "end")
      };
    }
    const away = geo.side === "left" ? "right" : "left";
    const gap = geo.radius + 6;
    if (away === "right") {
      return { x: c.labelPos.x + gap, y: c.labelPos.y, anchor: "start" };
    }
    return { x: c.labelPos.x - gap, y: c.labelPos.y, anchor: "end" };
  }
  function labelLines(text3, fontSize) {
    const lines = text3.replace(/\r\n?/g, "\n").split("\n");
    const step = fontSize * 1.05;
    return lines.map((line, i) => ({ text: line, dy: (i - (lines.length - 1) / 2) * step }));
  }
  function calloutContentBounds(contentBox, resolved, fontSize) {
    let minX = contentBox.x;
    let minY = contentBox.y;
    let maxX = contentBox.x + contentBox.w;
    let maxY = contentBox.y + contentBox.h;
    const expand = (x, y) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };
    for (const c of resolved) {
      if (!c.visible) continue;
      const cFontSize = c.fontSize || fontSize;
      const geo = buildLeader(c, cFontSize);
      expand(c.anchorPoint.x, c.anchorPoint.y);
      expand(c.labelPos.x - geo.radius, c.labelPos.y - geo.radius);
      expand(c.labelPos.x + geo.radius, c.labelPos.y + geo.radius);
      if (c.elbow) expand(c.elbow.x, c.elbow.y);
      if (c.labelText) {
        const tp = labelTextPlacement(c, geo);
        for (const line of labelLines(c.labelText, cFontSize)) {
          const tw = line.text.length * cFontSize * 0.66;
          const left = tp.anchor === "start" ? tp.x : tp.anchor === "middle" ? tp.x - tw / 2 : tp.x - tw;
          expand(left, tp.y + line.dy - cFontSize * 0.65);
          expand(left + tw, tp.y + line.dy + cFontSize * 0.65);
        }
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function textAnnotationBounds(item) {
    const textWidth = Math.max(item.fontSize * 0.6, item.text.length * item.fontSize * 0.58);
    const width = Math.max(textWidth, item.style === "heading" ? item.ruleWidth : 0);
    let x = item.pos.x;
    if (item.align === "middle") x -= width / 2;
    else if (item.align === "end") x -= width;
    const top = item.pos.y - item.fontSize * 0.65;
    const bottom = item.pos.y + (item.style === "heading" ? item.fontSize * 0.95 : item.fontSize * 0.65);
    return { x, y: top, w: width, h: bottom - top };
  }
  function diagramContentBounds(contentBox, resolved, fontSize, textAnnotations = [], drawingElements = []) {
    const callouts = calloutContentBounds(contentBox, resolved, fontSize);
    let minX = callouts.x;
    let minY = callouts.y;
    let maxX = callouts.x + callouts.w;
    let maxY = callouts.y + callouts.h;
    for (const item of textAnnotations) {
      const b = textAnnotationBounds(item);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    for (const item of drawingElements) {
      const pad = Math.max(1, item.strokeWidth) / 2;
      minX = Math.min(minX, item.start.x - pad, item.end.x - pad);
      minY = Math.min(minY, item.start.y - pad, item.end.y - pad);
      maxX = Math.max(maxX, item.start.x + pad, item.end.x + pad);
      maxY = Math.max(maxY, item.start.y + pad, item.end.y + pad);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function polylineToPoints(points) {
    return points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
  }
  function arrowHead(tip, from, size) {
    const dx = tip.x - from.x;
    const dy = tip.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const bx = tip.x - ux * size;
    const by = tip.y - uy * size;
    const half = size * 0.5;
    const p1 = `${round(bx - uy * half)},${round(by + ux * half)}`;
    const p2 = `${round(bx + uy * half)},${round(by - ux * half)}`;
    return `${round(tip.x)},${round(tip.y)} ${p1} ${p2}`;
  }
  function hexPoints(center, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 6;
      pts.push(`${round(center.x + r * Math.cos(a))},${round(center.y + r * Math.sin(a))}`);
    }
    return pts.join(" ");
  }
  function round(n) {
    return Math.round(n * 100) / 100;
  }
  function roundScale(n) {
    return Math.round(n * 1e6) / 1e6;
  }

  // vendor/drawer/src/diagramMappings.ts
  var MAX_REFERENCE_BYTES = 1024 * 1024;
  var MAX_TOTAL_REFERENCE_BYTES = 2 * 1024 * 1024;
  var own2 = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function mappedLabel(anchor, fallback, mode = "label", values = {}) {
    const mapping = anchor?.mapping;
    if (mode === "label") return fallback;
    const name = mapping?.display?.trim() || fallback;
    if (mode === "mapped-label") return name;
    const key = mapping?.fieldKey;
    const value = key && own2(values, key) ? values[key] : void 0;
    const text3 = value === void 0 || value === null ? "\u2014" : String(value);
    return mode === "label-value" ? `${name}
${text3}` : text3;
  }

  // vendor/drawer/src/resolve.ts
  function getView(doc, viewId) {
    const id = viewId ?? doc.activeViewId;
    return doc.views.find((v) => v.id === id) ?? doc.views[0];
  }
  function siteDisplayFor(view) {
    return view.siteDisplay ?? (view.labelMode === "blank" ? "blank" : "numbers");
  }
  function resolveCallouts(doc, viewId) {
    const view = getView(doc, viewId);
    const anchorById = new Map(doc.anchors.map((a) => [a.id, a]));
    const siteById2 = new Map((doc.sites ?? []).map((s) => [s.id, s]));
    const siteDisplay = siteDisplayFor(view);
    let visibleCount = doc.callouts.some((c) => c.siteId && siteById2.has(c.siteId)) ? Math.max(0, ...(doc.sites ?? []).map((s) => s.number)) : 0;
    return doc.callouts.map((c) => {
      const ov = view.overrides[c.id] ?? {};
      const anchor = anchorById.get(c.anchorId);
      const site = c.siteId ? siteById2.get(c.siteId) : void 0;
      const visible = (ov.visible ?? true) && isImageVisible(doc, anchor?.imageId);
      let index = site?.number ?? 0;
      if (!site && visible) index = ++visibleCount;
      const anchorPoint = anchor ? anchorPagePoint(doc, anchor) : c.labelPos;
      const vs = view.style;
      const leaderStyle = vs?.leaderStyle ?? c.leaderStyle;
      const labelPos = leaderStyle === "none" ? anchorPoint : ov.labelPos ?? c.labelPos;
      const elbow = leaderStyle === "none" ? null : ov.elbow !== void 0 ? ov.elbow : c.elbow;
      let labelText = ov.labelText ?? mappedLabel(anchor, c.labelText, view.mappingMode, doc.mappingValues);
      let balloonShape = ov.balloonShape ?? vs?.balloonShape ?? c.balloonShape;
      let balloonText = ov.balloonText ?? c.balloonText;
      const anchorMarker = vs?.anchorMarker ?? c.anchorMarker ?? DEFAULT_STYLE.anchorMarker;
      const leaderEnd = vs?.leaderEnd ?? c.leaderEnd ?? DEFAULT_STYLE.leaderEnd;
      const dashed = vs?.dashed ?? c.dashed ?? DEFAULT_STYLE.dashed;
      const leaderWidth = vs?.leaderWidth ?? c.leaderWidth ?? DEFAULT_STYLE.leaderWidth ?? 1.6;
      const fontSize = vs?.fontSize ?? c.fontSize ?? fontSizeFor(doc.base.viewBox);
      const fontWeight = vs?.fontWeight ?? c.fontWeight ?? DEFAULT_STYLE.fontWeight ?? 500;
      if (site) {
        ;
        ({ labelText, balloonShape, balloonText } = siteContent(site, siteDisplay, balloonShape, doc));
      } else {
        switch (view.labelMode) {
          case "names":
            break;
          case "numbers":
            labelText = "";
            balloonShape = balloonShape === "none" ? "circle" : balloonShape;
            balloonText = String(index);
            break;
          case "blank":
            labelText = "";
            balloonShape = balloonShape === "none" ? "circle" : balloonShape;
            balloonText = "";
            break;
        }
      }
      return {
        id: c.id,
        anchorId: c.anchorId,
        anchorPoint,
        labelOffset: ov.labelOffset ?? c.labelOffset,
        labelAlign: ov.labelAlign ?? c.labelAlign,
        labelText,
        balloonShape,
        balloonText,
        leaderStyle,
        anchorMarker,
        leaderEnd,
        dashed,
        leaderWidth,
        fontSize,
        fontWeight,
        labelPos,
        elbow,
        // a mono view renders every callout in ink black (per-callout colors kept in the model)
        color: view.mono ? "#111111" : c.color,
        visible,
        index,
        imageId: anchor?.imageId,
        siteId: site?.id
      };
    });
  }
  function siteContent(site, display, shape, doc) {
    const balloonShape = shape === "none" ? "circle" : shape;
    const number = String(site.number);
    switch (display) {
      case "numbers":
        return { labelText: "", balloonShape, balloonText: number };
      case "names":
        return { labelText: site.label, balloonShape, balloonText: number };
      case "values": {
        const values = doc.mappingValues ?? {};
        const value = Object.prototype.hasOwnProperty.call(values, site.fieldKey) ? values[site.fieldKey] : null;
        return { labelText: value === null || value === void 0 ? "\u2014" : String(value), balloonShape, balloonText: number };
      }
      case "blank":
        return { labelText: "", balloonShape, balloonText: "" };
    }
  }
  function buildLegend(doc, viewId) {
    const resolved = resolveCallouts(doc, viewId);
    return resolved.filter((r) => r.visible && !r.siteId).map((r) => {
      const base = doc.callouts.find((c) => c.id === r.id);
      return { index: r.index, name: base?.labelText ?? "" };
    });
  }

  // vendor/drawer/src/docModel.ts
  function pageDrawing(viewBox) {
    return { inner: "", viewBox: { ...viewBox }, contentBox: { ...viewBox }, targetBoxes: {} };
  }
  var SITE_MARKER_STYLE = {
    balloonShape: "badge",
    leaderStyle: "none",
    anchorMarker: "none",
    leaderEnd: "none",
    dashed: false,
    leaderWidth: 1.4,
    fontWeight: 500
  };
  function siteById(doc, id) {
    return id ? doc.sites?.find((s) => s.id === id) : void 0;
  }
  function sortedSites(doc) {
    return [...doc.sites ?? []].sort((a, b) => a.number - b.number);
  }
  function siteLegendBox(doc) {
    const g = doc.siteLegend;
    const sites = doc.sites ?? [];
    if (!g || !g.visible || !sites.length) return null;
    const longest = Math.max(g.heading.length, ...sites.map((s) => `${s.number}. ${s.label}`.length));
    return { x: g.pos.x, y: g.pos.y, w: longest * g.fontSize * 0.56, h: g.rowHeight * sites.length + g.fontSize * 1.1 };
  }
  function siteLegendLayout(doc) {
    const g = doc.siteLegend;
    if (!g || !g.visible || !(doc.sites ?? []).length) return null;
    return {
      heading: { x: g.pos.x, y: g.pos.y + g.fontSize * 0.72, text: g.heading, fontSize: g.fontSize },
      rows: sortedSites(doc).map((site, k) => {
        const y = g.pos.y + g.rowHeight * (k + 1) + g.fontSize * 0.72;
        return { siteId: site.id, x: g.pos.x, y, top: y - g.fontSize, height: g.rowHeight, text: `${site.number}. ${site.label}`, fontSize: g.fontSize };
      })
    };
  }

  // vendor/drawer/src/svgSafety.ts
  var NS = "http://www.w3.org/2000/svg";
  var TAGS = /* @__PURE__ */ new Set(["svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "textPath", "title", "desc", "clipPath", "mask", "linearGradient", "radialGradient", "stop", "pattern", "marker", "use", "image"]);
  var CSS = /* @__PURE__ */ new Set(["fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit", "opacity", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "letter-spacing", "word-spacing", "display", "visibility", "clip-path", "vector-effect", "paint-order"]);
  var LOCAL_REF = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;
  var RASTER_DATA = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/;
  function safePaint(value) {
    if (/[\\<>]|\/\*|javascript\s*:|data\s*:|https?\s*:|@import|expression\s*\(/i.test(value)) return false;
    let remaining = value;
    remaining = remaining.replace(/url\(\s*(['"]?)(#[A-Za-z_][A-Za-z0-9_.:-]*)\1\s*\)/gi, "");
    return !/url\s*\(/i.test(remaining);
  }
  function inlineStyleSheets(root) {
    const sheets = Array.from(root.querySelectorAll("style"));
    if (!sheets.length) return;
    const applied = /* @__PURE__ */ new Map();
    for (const sheet of sheets) {
      const css = (sheet.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const rule of css.split("}")) {
        const brace = rule.indexOf("{");
        if (brace < 0) continue;
        const declarations = rule.slice(brace + 1).trim();
        if (!declarations || /[<>\\]|@import/i.test(declarations)) continue;
        for (const raw of rule.slice(0, brace).split(",")) {
          const selector = raw.trim();
          if (!/^(?:[A-Za-z][\w-]*)?(?:[.#][A-Za-z_][\w-]*)*$/.test(selector) || !selector) continue;
          let matches = [];
          try {
            matches = Array.from(root.querySelectorAll(selector));
          } catch {
            continue;
          }
          for (const el of matches) applied.set(el, [...applied.get(el) ?? [], declarations]);
        }
      }
    }
    for (const [el, declarations] of applied) {
      const own4 = el.getAttribute("style");
      el.setAttribute("style", [...declarations, own4 ?? ""].filter(Boolean).join(";"));
    }
  }
  function sanitizeSvgElement(root) {
    inlineStyleSheets(root);
    const elements = [root, ...Array.from(root.querySelectorAll("*"))];
    for (const el of elements) {
      if (el !== root && (!TAGS.has(el.localName) || el.namespaceURI !== NS)) {
        el.remove();
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.localName;
        if (/^on/i.test(name) || ["src", "srcset", "base", "tabindex"].includes(name.toLowerCase())) {
          el.removeAttributeNode(attr);
        } else if (name === "href") {
          const value = attr.value.trim();
          if (!LOCAL_REF.test(value) && !(el.localName === "image" && RASTER_DATA.test(value))) el.removeAttributeNode(attr);
        } else if (name === "style") {
          const style = document.createElement("span").style;
          style.cssText = attr.value;
          const clean = [];
          for (let i = 0; i < style.length; i++) {
            const key = style.item(i);
            const value = style.getPropertyValue(key);
            if (CSS.has(key) && safePaint(value)) clean.push(`${key}:${value}`);
          }
          el.removeAttributeNode(attr);
          if (clean.length) el.setAttribute("style", clean.join(";"));
        } else if (!safePaint(attr.value) && !["xmlns", "id", "data-drawer-el"].includes(attr.name)) {
          el.removeAttributeNode(attr);
        }
      }
    }
  }

  // vendor/drawer/src/svgParse.ts
  function parseViewBox(svg) {
    const vb = svg.getAttribute("viewBox");
    if (vb) {
      const [x, y, w2, h2] = vb.split(/[\s,]+/).map(Number);
      if (vb.split(/[\s,]+/).length === 4 && [x, y, w2, h2].every((n) => Number.isFinite(n)) && w2 > 0 && h2 > 0) return { x, y, w: w2, h: h2 };
      throw new Error("The SVG viewBox must have four finite numbers and a positive size.");
    }
    const w = Number(svg.getAttribute("width")) || 100;
    const h = Number(svg.getAttribute("height")) || 100;
    if (!(w > 0 && h > 0)) throw new Error("The SVG dimensions must be positive.");
    return { x: 0, y: 0, w, h };
  }
  function measureGeometry(inner, viewBox) {
    if (typeof document === "undefined") return { contentBox: viewBox, targetBoxes: {} };
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    svg.style.position = "absolute";
    svg.style.left = "-100000px";
    svg.style.top = "0";
    svg.style.width = `${viewBox.w}px`;
    svg.style.height = `${viewBox.h}px`;
    const g = document.createElementNS(ns, "g");
    g.innerHTML = inner;
    svg.appendChild(g);
    document.body.appendChild(svg);
    let contentBox = viewBox;
    const targetBoxes = /* @__PURE__ */ Object.create(null);
    try {
      const b = g.getBBox();
      if (b.width > 0 && b.height > 0) {
        contentBox = { x: b.x, y: b.y, w: b.width, h: b.height };
      }
      g.querySelectorAll("[id],[data-drawer-el]").forEach((el) => {
        if (el.closest('[data-drawer-decoration="true"]')) return;
        const key = el.id || el.getAttribute("data-drawer-el");
        if (!key) return;
        try {
          const eb = el.getBBox();
          if (eb.width > 0 || eb.height > 0) {
            const rootMatrix = g.getCTM();
            const elementMatrix = el.getCTM();
            if (!rootMatrix || !elementMatrix) return;
            const matrix = rootMatrix.inverse().multiply(elementMatrix);
            const corners = [[eb.x, eb.y], [eb.x + eb.width, eb.y], [eb.x, eb.y + eb.height], [eb.x + eb.width, eb.y + eb.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
            const xs = corners.map((p) => p.x);
            const ys = corners.map((p) => p.y);
            if (![...xs, ...ys].every(Number.isFinite)) return;
            targetBoxes[key] = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
          }
        } catch {
        }
      });
    } catch {
      contentBox = viewBox;
    } finally {
      document.body.removeChild(svg);
    }
    return { contentBox, targetBoxes };
  }
  var sanitizeElement = sanitizeSvgElement;
  function parseSvg(raw) {
    const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
    if (doc.querySelector("parsererror")) {
      throw new Error("The file could not be parsed as valid SVG/XML.");
    }
    const svg = doc.querySelector("svg");
    if (!svg || svg !== doc.documentElement || svg.namespaceURI !== "http://www.w3.org/2000/svg") throw new Error("The file must have a namespaced <svg> root.");
    const viewBox = parseViewBox(svg);
    svg.querySelectorAll("title").forEach((t) => t.remove());
    sanitizeElement(svg);
    const handles = /* @__PURE__ */ new Set();
    svg.querySelectorAll("[id],[data-drawer-el]").forEach((el) => {
      const id = el.id || el.getAttribute("data-drawer-el");
      if (handles.has(id) || ["__proto__", "constructor", "prototype"].includes(id)) throw new Error(`Duplicate or reserved SVG target: ${id}`);
      handles.add(id);
    });
    let n = 0;
    svg.querySelectorAll("path, circle, ellipse, rect, polygon, polyline, line").forEach((el) => {
      if (!el.id && !el.getAttribute("data-drawer-el") && !el.closest('[data-drawer-decoration="true"]')) {
        while (handles.has(`el${++n}`)) {
        }
        el.setAttribute("data-drawer-el", `el${n}`);
        handles.add(`el${n}`);
      }
    });
    const inner = svg.innerHTML.trim();
    const { contentBox, targetBoxes } = measureGeometry(inner, viewBox);
    return { inner, viewBox, contentBox, targetBoxes };
  }

  // vendor/drawer/src/sceneImport.ts
  var SCENE_FORMAT = "drawer-scene";
  var obj = (v, what) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`Invalid ${what}.`);
    return v;
  };
  var list = (v, what, max) => {
    if (v === void 0) return [];
    if (!Array.isArray(v) || v.length > max) throw new Error(`Invalid ${what}; at most ${max} allowed.`);
    return v;
  };
  var num = (v, what, min = -1e5, max = 1e5) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`${what} must be a number from ${min} to ${max}.`);
    return v;
  };
  var text = (v, what, max = 2e3) => {
    if (typeof v !== "string" || v.length > max) throw new Error(`Invalid ${what}.`);
    return v;
  };
  var ident = (v) => {
    const s = text(v, "ID", 80);
    if (!/^[A-Za-z][\w-]*$/.test(s)) throw new Error("Scene IDs must begin with a letter and contain only letters, numbers, underscores or hyphens.");
    return s;
  };
  var unique = (ids, what) => {
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${what} IDs.`);
  };
  var boolean = (v, what) => {
    if (typeof v !== "boolean") throw new Error(`${what} must be true or false.`);
    return v;
  };
  var targetName = (v) => {
    if (v === void 0 || v === null) return null;
    const id = text(v, "target ID", 240);
    if (!id.trim()) throw new Error("Invalid target ID.");
    return id;
  };
  var checkedTargetBox = (drawing, targetId) => {
    if (targetId !== null && !Object.prototype.hasOwnProperty.call(drawing.targetBoxes, targetId)) {
      throw new Error(`Missing SVG target "${targetId}".`);
    }
    const box2 = boxForTarget(drawing, targetId);
    if (![box2.x, box2.y, box2.w, box2.h].every(Number.isFinite) || box2.w <= 0 || box2.h <= 0) {
      throw new Error(`${targetId === null ? "Content" : `SVG target "${targetId}"`} bounding box must have finite coordinates and positive width and height.`);
    }
    return box2;
  };
  function parseSceneAsset(inner, width, height) {
    return parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${inner}</svg>`);
  }
  function sceneToDoc(input, parseDrawing = parseSceneAsset) {
    const scene = obj(input, "scene");
    if (scene.format !== SCENE_FORMAT || scene.version !== 1) throw new Error("Expected a drawer-scene version 1 file.");
    const sceneId = ident(scene.id);
    const name = text(scene.name, "scene name", 240);
    const width = num(scene.width, "Page width", 100, 12e3);
    const height = num(scene.height, "Page height", 100, 12e3);
    const pageRule = scene.pageRule === void 0 ? true : boolean(scene.pageRule, "Page rule");
    const cleanView = scene.cleanView === void 0 ? false : boolean(scene.cleanView, "Clean view");
    let provenance;
    if (scene.provenance !== void 0) {
      const entries = Object.entries(obj(scene.provenance, "scene provenance"));
      if (entries.length > 40) throw new Error("Invalid scene provenance; at most 40 entries allowed.");
      provenance = Object.fromEntries(entries.map(([key, value]) => {
        if (!key.trim() || key.length > 240 || ["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Invalid provenance key.");
        return [key, text(value, "provenance value", 4e3)];
      }));
    }
    const assets = /* @__PURE__ */ new Map();
    for (const raw of list(scene.assets, "assets", 100)) {
      const a = obj(raw, "asset");
      const id = ident(a.id);
      if (assets.has(id)) throw new Error("Duplicate asset IDs.");
      const w = num(a.width, "Asset width", 1, 12e3);
      const h = num(a.height, "Asset height", 1, 12e3);
      const drawing = parseDrawing(text(a.inner, "asset markup", 3e6), w, h);
      const landmarks2 = list(a.landmarks, "asset landmarks", 2e3).map((raw2) => {
        const l = obj(raw2, "asset landmark");
        const targetId = targetName(l.targetId);
        const local = { x: num(l.x, "Landmark x", 0, w), y: num(l.y, "Landmark y", 0, h) };
        const label = text(l.label, "landmark label", 240);
        if (!label.trim()) throw new Error("A landmark needs a label.");
        return {
          id: ident(l.id),
          name: label,
          targetId,
          ...pointToNormalized(local, checkedTargetBox(drawing, targetId))
        };
      });
      unique(landmarks2.map((l) => l.id), "asset landmark");
      assets.set(id, {
        name: text(a.name, "asset name", 240),
        width: w,
        height: h,
        drawing,
        source: a.source === void 0 ? "" : text(a.source, "asset source", 1e3),
        landmarks: landmarks2
      });
    }
    const images = [];
    const landmarks = [];
    for (const raw of list(scene.images, "images", 100)) {
      const i = obj(raw, "image");
      const asset = assets.get(String(i.assetId));
      if (!asset) throw new Error(`Image ${String(i.id)} refers to a missing asset.`);
      const image = {
        id: ident(i.id),
        name: text(i.name, "image name", 240),
        drawing: structuredClone(asset.drawing),
        x: num(i.x, "Image x"),
        y: num(i.y, "Image y"),
        width: num(i.width, "Image width", 1, 12e3),
        height: num(i.height, "Image height", 1, 12e3),
        rotation: num(i.rotation ?? 0, "Rotation", -3600, 3600),
        ...i.flipX === void 0 ? {} : { flipX: boolean(i.flipX, "Image flipX") },
        visible: i.visible === void 0 ? true : Boolean(i.visible),
        locked: Boolean(i.locked),
        ...asset.source ? { source: asset.source } : {}
      };
      images.push(image);
      landmarks.push(...asset.landmarks.map((l) => ({
        ...l,
        // Length-prefix the image ID so hyphenated image/landmark IDs cannot collide.
        id: `landmark-${image.id.length}-${image.id}-${l.id}`,
        imageId: image.id,
        group: image.name
      })));
    }
    unique(images.map((i) => i.id), "image");
    const imageById = new Map(images.map((i) => [i.id, i]));
    const assetSize = (image) => image.drawing.viewBox;
    const sites = [];
    const mappingValues = {};
    for (const raw of list(scene.sites, "sites", 500)) {
      const r = obj(raw, "site");
      const number = num(r.number, "Site number", 1, 9999);
      if (!Number.isInteger(number)) throw new Error("Site numbers must be whole numbers.");
      const fieldKey = text(r.fieldKey, "field key", 200);
      if (!fieldKey.trim() || ["__proto__", "prototype", "constructor"].includes(fieldKey)) throw new Error("Invalid field key.");
      const value = r.value ?? null;
      if (!(value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number" && Number.isFinite(value))) {
        throw new Error("Site values must be text, finite numbers, true/false or empty.");
      }
      if (value !== null) mappingValues[fieldKey] = value;
      sites.push({ id: ident(r.id), number, label: text(r.label, "site label", 240), fieldKey });
    }
    unique(sites.map((s) => s.id), "site");
    if (new Set(sites.map((s) => s.number)).size !== sites.length) throw new Error("Site numbers must be unique.");
    if (new Set(sites.map((s) => s.fieldKey)).size !== sites.length) throw new Error("Each site needs a unique field key.");
    const siteById2 = new Map(sites.map((s) => [s.id, s]));
    const anchors = [];
    const callouts = [];
    const hidden = [];
    const anchorAt = (id, image, u, v, targetId = null) => {
      const vb = assetSize(image);
      const local = { x: vb.x + u * vb.w, y: vb.y + v * vb.h };
      return { id, mode: "relative-bbox", imageId: image.id, relative: { targetId, ...pointToNormalized(local, checkedTargetBox(image.drawing, targetId)) } };
    };
    const pagePoint = (image, u, v) => {
      const vb = assetSize(image);
      return imageToPage(image, { x: vb.x + u * vb.w, y: vb.y + v * vb.h });
    };
    for (const raw of list(scene.links, "connections", 2e3)) {
      const l = obj(raw, "connection");
      const id = ident(l.id);
      const image = imageById.get(String(l.imageId));
      const site = siteById2.get(String(l.siteId));
      if (!image || !site) throw new Error(`Connection ${id} has a missing image or site.`);
      const u = num(l.u, "Connection u", 0, 1);
      const v = num(l.v, "Connection v", 0, 1);
      const radius = num(l.radius ?? 13, "Marker radius", 2, 80);
      const anchor = anchorAt(`anchor-${id}`, image, u, v, targetName(l.targetId));
      anchors.push(anchor);
      callouts.push({
        id: `callout-${id}`,
        anchorId: anchor.id,
        siteId: site.id,
        labelText: site.label,
        balloonText: String(site.number),
        ...SITE_MARKER_STYLE,
        // a badge's radius is 0.95 × its font size (see balloonRadius)
        fontSize: Math.round(radius / 0.95 * 100) / 100,
        labelPos: pagePoint(image, u, v),
        elbow: null,
        color: "#111111"
      });
      if (l.visible === false) hidden.push(`callout-${id}`);
    }
    for (const raw of list(scene.annotations, "anatomy labels", 1e3)) {
      const a = obj(raw, "anatomy label");
      const id = ident(a.id);
      const image = imageById.get(String(a.imageId));
      if (!image) throw new Error("An anatomy label refers to a missing image.");
      const fontSize = num(a.fontSize ?? 25, "Label font size", 6, 120);
      const align = a.align === "end" ? "end" : "start";
      const anchor = anchorAt(`anchor-${id}`, image, num(a.u, "Label u", -4, 5), num(a.v, "Label v", -4, 5));
      const q = pagePoint(image, num(a.labelU, "Label u", -4, 5), num(a.labelV, "Label v", -4, 5));
      const end = { x: q.x + (align === "end" ? 7 : -7), y: q.y - 5 };
      anchors.push(anchor);
      callouts.push({
        id: `callout-${id}`,
        anchorId: anchor.id,
        labelText: text(a.label, "anatomy label", 240),
        balloonShape: "none",
        balloonText: "",
        leaderStyle: "straight",
        anchorMarker: "none",
        leaderEnd: "none",
        dashed: false,
        leaderWidth: 1.8,
        fontSize,
        fontWeight: 400,
        labelPos: end,
        // scene text sits on a baseline; Drawer centers text vertically
        labelOffset: { x: q.x - end.x, y: q.y - fontSize * 0.35 - end.y },
        labelAlign: align,
        elbow: null,
        color: "#333333"
      });
    }
    unique(anchors.map((a) => a.id), "anchor");
    const textAnnotations = [];
    const drawingElements = pageRule ? [
      // the source sheet's top rule
      { id: "page-rule", kind: "line", start: { x: 30, y: 6 }, end: { x: 1507, y: 6 }, stroke: "#222222", strokeWidth: 2, dashed: false, fill: null }
    ] : [];
    for (const raw of list(scene.texts, "texts", 500)) {
      const t = obj(raw, "text");
      const id = ident(t.id);
      const image = t.imageId === void 0 ? void 0 : imageById.get(String(t.imageId));
      if (t.imageId !== void 0 && !image) throw new Error("A text item refers to a missing image.");
      const fontSize = num(t.fontSize ?? 24, "Font size", 6, 150);
      const align = t.align ?? "start";
      if (align !== "start" && align !== "middle" && align !== "end") throw new Error("Text alignment must be start, middle or end.");
      const x = num(t.x, "Text x");
      const y = num(t.y, "Text y");
      const p = image ? imageToPage(image, { x: image.drawing.viewBox.x + x, y: image.drawing.viewBox.y + y }) : { x, y };
      textAnnotations.push({
        id,
        text: text(t.text, "text"),
        pos: { x: p.x, y: p.y - fontSize * 0.35 },
        style: "plain",
        fontSize,
        fontWeight: t.bold ? 700 : 400,
        align,
        color: "#111111",
        ruleWidth: 0,
        ...image ? { imageId: image.id } : {}
      });
      const ruleWidth = num(t.ruleWidth ?? 0, "Rule width", 0, 3e3);
      if (ruleWidth) {
        const offset = num(t.ruleOffsetX ?? 0, "Rule offset", -3e3, 3e3);
        drawingElements.push({
          id: `rule-${id}`,
          kind: "line",
          start: { x: p.x + offset, y: p.y + 8 },
          end: { x: p.x + offset + ruleWidth, y: p.y + 8 },
          stroke: "#555555",
          strokeWidth: 2,
          dashed: false,
          fill: null,
          ...image ? { imageId: image.id } : {}
        });
      }
    }
    unique(textAnnotations.map((t) => t.id), "text");
    const g = obj(scene.legend, "legend");
    const hide = Object.fromEntries(hidden.map((id) => [id, { visible: false }]));
    const view = (id, viewName, siteDisplay) => ({
      id,
      name: viewName,
      labelMode: "names",
      siteDisplay,
      overrides: structuredClone(hide)
    });
    return {
      id: sceneId,
      name,
      ...provenance ? { provenance } : {},
      base: pageDrawing({ x: 0, y: 0, w: width, h: height }),
      images,
      sites,
      siteLegend: {
        pos: { x: num(g.x, "Legend x"), y: num(g.y, "Legend y") },
        heading: text(g.heading, "legend heading", 240),
        fontSize: num(g.fontSize, "Legend font size", 6, 120),
        rowHeight: num(g.rowHeight, "Legend row height", 10, 300),
        visible: g.visible === void 0 ? true : Boolean(g.visible)
      },
      exportFrame: "page",
      anchors,
      callouts,
      views: [
        ...cleanView ? [{
          ...view("artwork", "Clean artwork", "numbers"),
          overrides: Object.fromEntries(callouts.map((c) => [c.id, { visible: false }]))
        }] : [],
        view("site-numbers", "Site numbers", "numbers"),
        view("site-names", "Site names", "names"),
        view("field-values", "Field values", "values"),
        view("blank-markers", "Blank markers", "blank")
      ],
      activeViewId: cleanView ? "artwork" : "site-numbers",
      landmarks,
      textAnnotations,
      drawingElements,
      landmarkGroupOrder: [...new Set(landmarks.map((l) => l.group))],
      hiddenLandmarkGroups: [],
      mappingValues
    };
  }

  // vendor/drawer/src/surface.ts
  var own3 = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function toPage(doc, imageId, p) {
    const image = findImage(doc, imageId);
    return image ? imageToPage(image, p) : p;
  }
  function toLocal(doc, imageId, p) {
    const image = findImage(doc, imageId);
    return image ? pageToImage(image, p) : p;
  }
  function drawingOf(doc, imageId) {
    return findImage(doc, imageId)?.drawing ?? doc.base;
  }
  function areaLocalPolygon(doc, area, ellipseSteps = 32) {
    const s = area.shape;
    switch (s.kind) {
      case "rect":
        return [
          { x: s.x, y: s.y },
          { x: s.x + s.w, y: s.y },
          { x: s.x + s.w, y: s.y + s.h },
          { x: s.x, y: s.y + s.h }
        ];
      case "ellipse": {
        const pts = [];
        for (let i = 0; i < ellipseSteps; i++) {
          const a = Math.PI * 2 * i / ellipseSteps;
          pts.push({ x: s.cx + s.rx * Math.cos(a), y: s.cy + s.ry * Math.sin(a) });
        }
        return pts;
      }
      case "polygon":
        return s.points.map((p) => ({ ...p }));
      case "part": {
        const b = boxForTarget(drawingOf(doc, area.imageId), s.targetId);
        return [
          { x: b.x, y: b.y },
          { x: b.x + b.w, y: b.y },
          { x: b.x + b.w, y: b.y + b.h },
          { x: b.x, y: b.y + b.h }
        ];
      }
    }
  }
  function areaCenter(doc, area) {
    const s = area.shape;
    if (s.kind === "ellipse") return toPage(doc, area.imageId, { x: s.cx, y: s.cy });
    const pts = areaLocalPolygon(doc, area);
    const c = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }), { x: 0, y: 0 });
    return toPage(doc, area.imageId, c);
  }
  function pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > p.y !== b.y > p.y && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y || 1e-12) + a.x) inside = !inside;
    }
    return inside;
  }
  function pointInArea(doc, area, page) {
    if (!isImageVisible(doc, area.imageId)) return false;
    const p = toLocal(doc, area.imageId, page);
    const s = area.shape;
    if (s.kind === "ellipse") {
      if (s.rx <= 0 || s.ry <= 0) return false;
      const dx = (p.x - s.cx) / s.rx;
      const dy = (p.y - s.cy) / s.ry;
      return dx * dx + dy * dy <= 1;
    }
    if (s.kind === "part" && !own3(drawingOf(doc, area.imageId).targetBoxes ?? {}, s.targetId)) return false;
    return pointInPolygon(p, areaLocalPolygon(doc, area));
  }
  function areasAtPoint(doc, page) {
    const size = (a) => {
      const pts = areaLocalPolygon(doc, a);
      let sum = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) sum += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
      return Math.abs(sum / 2);
    };
    return (doc.areas ?? []).filter((a) => pointInArea(doc, a, page)).sort((a, b) => size(a) - size(b));
  }
  function areaOutlineMarkup(doc, area, attrs) {
    const s = area.shape;
    if (s.kind === "part") return "";
    const image = findImage(doc, area.imageId);
    const wrap = (inner) => image ? `<g transform="${imageTransformFor(image)}">${inner}</g>` : inner;
    if (s.kind === "rect") return wrap(`<rect x="${round(s.x)}" y="${round(s.y)}" width="${round(s.w)}" height="${round(s.h)}" ${attrs}/>`);
    if (s.kind === "ellipse") return wrap(`<ellipse cx="${round(s.cx)}" cy="${round(s.cy)}" rx="${round(s.rx)}" ry="${round(s.ry)}" ${attrs}/>`);
    return wrap(`<polygon points="${s.points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" ${attrs}/>`);
  }
  function imageTransformFor(image) {
    const vb = image.drawing.viewBox;
    const sx = image.width / vb.w * (image.flipX ? -1 : 1);
    const sy = image.height / vb.h;
    return `translate(${round(image.x + image.width / 2)} ${round(image.y + image.height / 2)}) rotate(${round(image.rotation)}) scale(${Math.round(sx * 1e6) / 1e6} ${Math.round(sy * 1e6) / 1e6}) translate(${round(-(vb.x + vb.w / 2))} ${round(-(vb.y + vb.h / 2))})`;
  }
  function imageScale(doc, imageId) {
    const image = findImage(doc, imageId);
    if (!image) return 1;
    const vb = image.drawing.viewBox;
    return (image.width / vb.w + image.height / vb.h) / 2;
  }
  function markPagePoints(doc, mark) {
    return mark.points.map((p) => toPage(doc, mark.imageId, p));
  }
  function markMarkup(doc, mark, extraAttrs = "") {
    const pts = markPagePoints(doc, mark);
    const size = mark.size * imageScale(doc, mark.imageId);
    const sw = round(Math.max(1, size / 4.5));
    const col = mark.color.replace(/[<>"&]/g, "");
    const attrs = `class="drawer-mark" data-mark-id="${mark.id.replace(/[<>"&]/g, "")}"${mark.areaId ? ` data-area-id="${mark.areaId.replace(/[<>"&]/g, "")}"` : ""}${mark.siteId ? ` data-site-id="${mark.siteId.replace(/[<>"&]/g, "")}"` : ""}${extraAttrs} pointer-events="none"`;
    if (mark.kind === "stroke") {
      if (pts.length < 2) return "";
      return `<polyline ${attrs} points="${pts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    const c = pts[0];
    if (!c) return "";
    const h = size / 2;
    if (mark.symbol === "circle") return `<circle ${attrs} cx="${round(c.x)}" cy="${round(c.y)}" r="${round(h)}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
    if (mark.symbol === "triangle") {
      return `<polygon ${attrs} points="${round(c.x)},${round(c.y - h)} ${round(c.x - h)},${round(c.y + h)} ${round(c.x + h)},${round(c.y + h)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    }
    return `<g ${attrs}><line x1="${round(c.x - h)}" y1="${round(c.y - h)}" x2="${round(c.x + h)}" y2="${round(c.y + h)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/><line x1="${round(c.x + h)}" y1="${round(c.y - h)}" x2="${round(c.x - h)}" y2="${round(c.y + h)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/></g>`;
  }
  function groupSelection(doc, selectedAreaIds, selectedSiteIds = []) {
    const areas = new Set(selectedAreaIds);
    const sites = new Set(selectedSiteIds);
    const countsByGroup = {};
    const labelsByGroup = {};
    const sortedSites2 = [...doc.sites ?? []].sort((a, b) => a.number - b.number);
    for (const g of doc.groups ?? []) {
      const inAreas = new Set(g.areaIds);
      const inSites = new Set(g.siteIds);
      const labels = [
        ...(doc.areas ?? []).filter((a) => inAreas.has(a.id) && areas.has(a.id)).map((a) => a.label || a.id),
        ...sortedSites2.filter((s) => inSites.has(s.id) && sites.has(s.id)).map((s) => s.label)
      ];
      countsByGroup[g.id] = labels.length;
      labelsByGroup[g.id] = labels;
    }
    return { countsByGroup, labelsByGroup };
  }
  function countedGroups(doc) {
    return (doc.groups ?? []).filter((g) => g.showCount !== false);
  }
  function tagPartElements(inner, tags) {
    const ids = Object.keys(tags);
    if (!ids.length) return inner;
    return inner.replace(/<([A-Za-z][\w:-]*)(\s[^<>]*?)?(\/?)>/g, (whole, tag, attrs, selfClose) => {
      if (!attrs) return whole;
      const m = /\s(?:id|data-drawer-el)="([^"]*)"/.exec(attrs);
      if (!m || !own3(tags, m[1])) return whole;
      return `<${tag}${attrs} ${tags[m[1]]}${selfClose}>`;
    });
  }

  // vendor/drawer/src/export/exportSvg.ts
  var DEFAULT_SELECTED_COLOR = "#c50f1f";
  var LEGEND_VALUE_SCALE = 0.72;
  var FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif";
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function computeBounds(doc, resolved, fontSize, legendWidth, legendCount, texts = doc.textAnnotations.filter((t) => isImageVisible(doc, t.imageId)), guides = doc.drawingElements.filter((d) => isImageVisible(doc, d.imageId)), withSiteLegend = true) {
    const raw = diagramContentBounds(docContentBox(doc), resolved, fontSize, texts, guides);
    const legend = withSiteLegend ? siteLegendBox(doc) : null;
    if (legend) {
      const x2 = Math.max(raw.x + raw.w, legend.x + legend.w);
      const y2 = Math.max(raw.y + raw.h, legend.y + legend.h);
      raw.x = Math.min(raw.x, legend.x);
      raw.y = Math.min(raw.y, legend.y);
      raw.w = x2 - raw.x;
      raw.h = y2 - raw.y;
    }
    const m = fontSize;
    const legendHeight = legendCount > 0 ? (1.5 + legendCount * 1.35) * fontSize + m : 0;
    return {
      x: round(raw.x - m),
      y: round(raw.y - m),
      w: round(raw.w + m * 2 + legendWidth),
      h: round(Math.max(raw.h + m * 2, legendHeight))
    };
  }
  function renderTextAnnotation(item) {
    const parts = [];
    if (item.style === "heading") {
      const center = item.align === "middle" ? item.pos.x : item.align === "start" ? item.pos.x + item.ruleWidth / 2 : item.pos.x - item.ruleWidth / 2;
      const y = item.pos.y + item.fontSize * 0.78;
      parts.push(
        `<line x1="${round(center - item.ruleWidth / 2)}" y1="${round(y)}" x2="${round(center + item.ruleWidth / 2)}" y2="${round(y)}" stroke="${esc(item.color)}" stroke-width="${round(Math.max(1.5, item.fontSize * 0.065))}" stroke-linecap="round"/>`
      );
    }
    parts.unshift(
      `<text x="${round(item.pos.x)}" y="${round(item.pos.y)}" text-anchor="${item.align}" dominant-baseline="central" font-size="${round(item.fontSize)}" font-weight="${item.fontWeight}" fill="${esc(item.color)}">${esc(item.text)}</text>`
    );
    return `  <g class="text-annotation" data-text-id="${esc(item.id)}" data-text-style="${item.style}">
    ${parts.join("\n    ")}
  </g>`;
  }
  function renderDrawingElement(item) {
    const dash = item.dashed ? ` stroke-dasharray="${round(item.strokeWidth * 4)} ${round(item.strokeWidth * 3)}"` : "";
    if (item.kind === "line") {
      return `  <line class="drawing-element" data-drawing-id="${esc(item.id)}" x1="${round(item.start.x)}" y1="${round(item.start.y)}" x2="${round(item.end.x)}" y2="${round(item.end.y)}" fill="none" stroke="${esc(item.stroke)}" stroke-width="${round(item.strokeWidth)}" stroke-linecap="round"${dash}/>`;
    }
    const x = Math.min(item.start.x, item.end.x);
    const y = Math.min(item.start.y, item.end.y);
    const w = Math.abs(item.end.x - item.start.x);
    const h = Math.abs(item.end.y - item.start.y);
    return `  <rect class="drawing-element" data-drawing-id="${esc(item.id)}" x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="${item.fill ? esc(item.fill) : "none"}" stroke="${esc(item.stroke)}" stroke-width="${round(item.strokeWidth)}"${dash}/>`;
  }
  function renderCallout(c, anchor, baseName, fontSize, opts, site, state) {
    const fs = c.fontSize || fontSize;
    const geo = buildLeader(c, fs);
    const tp = labelTextPlacement(c, geo);
    const col = esc(c.color);
    const parts = [];
    const anc = c.anchorPoint;
    const fromPoint = geo.points[1] ?? c.labelPos;
    const dashAttr = c.dashed ? ` stroke-dasharray="${round(fs * 0.5)} ${round(fs * 0.36)}"` : "";
    if (state?.interactive && site) {
      parts.push(`<circle class="drawer-hit" cx="${round(c.labelPos.x)}" cy="${round(c.labelPos.y)}" r="${round(Math.max(geo.radius * 1.55, fs * 0.9))}" fill="transparent" stroke="none" pointer-events="all"/>`);
    }
    if (geo.points.length) {
      parts.push(
        `<polyline points="${polylineToPoints(geo.points)}" fill="none" stroke="${col}" stroke-width="${round(c.leaderWidth)}" stroke-linejoin="round" stroke-linecap="round"${dashAttr}/>`
      );
    }
    if (c.leaderEnd === "arrow") {
      parts.push(`<polygon points="${arrowHead(anc, fromPoint, fs * 0.55)}" fill="${col}"/>`);
    } else if (c.leaderEnd === "dot") {
      parts.push(`<circle cx="${round(anc.x)}" cy="${round(anc.y)}" r="${round(fs * 0.17)}" fill="${col}"/>`);
    }
    if (opts.includeAnchors !== false) {
      if (c.anchorMarker === "ring") {
        parts.push(
          `<circle cx="${round(anc.x)}" cy="${round(anc.y)}" r="${round(fs * 0.32)}" fill="#fff" stroke="${col}" stroke-width="${round(c.leaderWidth)}"/>`,
          `<circle cx="${round(anc.x)}" cy="${round(anc.y)}" r="${round(fs * 0.11)}" fill="${col}"/>`
        );
      } else if (c.anchorMarker === "dot") {
        parts.push(`<circle cx="${round(anc.x)}" cy="${round(anc.y)}" r="${round(fs * 0.2)}" fill="${col}"/>`);
      } else if (c.anchorMarker === "tick") {
        const ldx = fromPoint.x - anc.x;
        const ldy = fromPoint.y - anc.y;
        const llen = Math.hypot(ldx, ldy) || 1;
        const px = -ldy / llen * fs * 0.32;
        const py = ldx / llen * fs * 0.32;
        parts.push(
          `<line x1="${round(anc.x - px)}" y1="${round(anc.y - py)}" x2="${round(anc.x + px)}" y2="${round(anc.y + py)}" stroke="${col}" stroke-width="${round(c.leaderWidth)}" stroke-linecap="round"/>`
        );
      }
    }
    if (state?.selected) {
      parts.push(`<circle class="drawer-selected-ring" cx="${round(c.labelPos.x)}" cy="${round(c.labelPos.y)}" r="${round(geo.radius + Math.max(2.5, fs * 0.22))}" fill="none" stroke="${col}" stroke-width="${round(Math.max(1.5, fs * 0.12))}"/>`);
    }
    const balloonClass = state ? ' class="drawer-balloon"' : "";
    if (c.balloonShape === "circle") {
      parts.push(
        `<circle${balloonClass} cx="${round(c.labelPos.x)}" cy="${round(c.labelPos.y)}" r="${round(geo.radius)}" fill="#fff" stroke="${col}" stroke-width="${round(c.leaderWidth)}"/>`
      );
    } else if (c.balloonShape === "hex") {
      parts.push(
        `<polygon${balloonClass} points="${hexPoints(c.labelPos, geo.radius)}" fill="#fff" stroke="${col}" stroke-width="${round(c.leaderWidth)}"/>`
      );
    } else if (c.balloonShape === "badge") {
      parts.push(
        `<circle${balloonClass} cx="${round(c.labelPos.x)}" cy="${round(c.labelPos.y)}" r="${round(geo.radius)}" fill="${col}" stroke="#fff" stroke-width="${round(c.leaderWidth)}"/>`
      );
    }
    if (c.balloonShape !== "none" && c.balloonText) {
      const badge = c.balloonShape === "badge";
      parts.push(
        `<text x="${round(c.labelPos.x)}" y="${round(c.labelPos.y)}" text-anchor="middle" dominant-baseline="central" font-size="${round(fs * (badge ? 1.05 : 0.82))}" font-weight="${c.fontWeight}" fill="${badge ? "#fff" : col}">${esc(c.balloonText)}</text>`
      );
    }
    if (c.labelText) {
      const fill = state?.selected ? col : "#111";
      const weight = state?.selected ? 700 : c.fontWeight;
      parts.push(
        `<text x="${round(tp.x)}" y="${round(tp.y)}" text-anchor="${tp.anchor}" dominant-baseline="central" font-size="${round(fs)}" font-weight="${weight}" fill="${fill}">${labelLines(c.labelText, fs).map((line) => `<tspan x="${round(tp.x)}" y="${round(tp.y + line.dy)}">${esc(line.text)}</tspan>`).join("")}</text>`
      );
    }
    let attrs = state && site ? `class="callout site-marker" data-callout-id="${esc(c.id)}"` : `class="callout" data-callout-id="${esc(c.id)}"`;
    if (opts.includeMetadata !== false) {
      attrs += ` data-name="${esc(baseName)}" data-anchor-x="${round(c.anchorPoint.x)}" data-anchor-y="${round(c.anchorPoint.y)}"`;
      if (c.imageId) attrs += ` data-image-id="${esc(c.imageId)}"`;
      if (site) attrs += ` data-site-id="${esc(site.id)}" data-site-number="${site.number}" data-field-key="${esc(site.fieldKey)}"`;
      if (anchor) {
        attrs += ` data-anchor-mode="${anchor.mode}" data-anchor-id="${esc(anchor.id)}"`;
        if (anchor.mapping && !site) {
          attrs += ` data-field-key="${esc(anchor.mapping.fieldKey)}"`;
          if (anchor.mapping.system) attrs += ` data-code-system="${esc(anchor.mapping.system)}"`;
          if (anchor.mapping.code) attrs += ` data-code="${esc(anchor.mapping.code)}"`;
        }
        if (anchor.mode === "relative-bbox" && anchor.relative) {
          attrs += ` data-target="${esc(anchor.relative.targetId ?? "")}" data-nx="${round(anchor.relative.nx)}" data-ny="${round(anchor.relative.ny)}"`;
        }
      }
    } else if (site && state) {
      attrs += ` data-site-id="${esc(site.id)}"`;
    }
    let title = "";
    if (site && state) {
      if (state.selected) attrs += ` data-selected="true"`;
      if (state.interactive) {
        attrs += ` role="button" tabindex="0" aria-pressed="${state.selected}" aria-label="${esc(state.ariaLabel ?? site.label)}"`;
        title = `<title>${esc(state.ariaLabel ?? site.label)}</title>`;
      }
    }
    return `  <g ${attrs}>${title ? `
    ${title}` : ""}
    ${parts.join("\n    ")}
  </g>`;
  }
  function renderLegend(doc, bounds, fontSize, viewId, legendWidth = fontSize * 12, legend = buildLegend(doc, viewId)) {
    if (!legend.length) return "";
    const x = bounds.x + bounds.w - legendWidth + fontSize;
    let y = bounds.y + fontSize * 1.5;
    const lines = legend.map((l) => {
      const lines2 = l.name.replace(/\r\n?/g, "\n").split("\n").map((text3, i) => {
        const line = `<text x="${round(x)}" y="${round(y)}" font-size="${round(fontSize * 0.85)}" fill="#111">${i === 0 ? `${l.index}. ` : ""}${esc(text3)}</text>`;
        y += fontSize * 1.1;
        return line;
      });
      y += fontSize * 0.35;
      return lines2.join("\n    ");
    }).join("\n    ");
    return `  <g class="legend">
    ${lines}
  </g>`;
  }
  function valueText(value) {
    if (value === void 0 || value === null || value === "" || value === false || value === true) return "";
    return String(value);
  }
  function legendRows(doc, state) {
    const layout = siteLegendLayout(doc);
    if (!layout) return [];
    const selected = new Set(state?.selectedSiteIds ?? []);
    return layout.rows.map((r) => {
      const value = state?.legendValues ? valueText(state.siteValues?.[r.siteId]) : "";
      const width = r.text.length * r.fontSize * (selected.has(r.siteId) ? 0.6 : 0.56) + (value ? (value.length + 3) * r.fontSize * LEGEND_VALUE_SCALE * 0.6 : 0);
      return { ...r, value, width };
    });
  }
  function renderSiteLegend(doc, state, ariaFor) {
    const layout = siteLegendLayout(doc);
    if (!layout) return "";
    const h = layout.heading;
    if (!state) {
      const lines = [
        `<text x="${round(h.x)}" y="${round(h.y)}" font-size="${round(h.fontSize)}" font-weight="700" fill="#181818">${esc(h.text)}</text>`,
        ...layout.rows.map((r) => `<text x="${round(r.x)}" y="${round(r.y)}" font-size="${round(r.fontSize)}" fill="#181818" data-site-id="${esc(r.siteId)}">${esc(r.text)}</text>`)
      ];
      return `  <g class="site-legend">
    ${lines.join("\n    ")}
  </g>`;
    }
    const box2 = siteLegendBox(doc);
    const selected = new Set(state.selectedSiteIds ?? []);
    const interactive = !!state.interactive?.sites;
    const rows = legendRows(doc, state).map((r) => {
      const isSelected = selected.has(r.siteId);
      const colour = esc(state.colors?.[r.siteId] || state.selectedColor || DEFAULT_SELECTED_COLOR);
      const pad = r.fontSize * 0.25;
      const label = r.value ? `${esc(r.text)}<tspan font-size="${round(r.fontSize * LEGEND_VALUE_SCALE)}" font-weight="600"> \u2014 ${esc(r.value)}</tspan>` : esc(r.text);
      const rect = isSelected ? `<rect class="drawer-legend-highlight" x="${round(r.x - pad)}" y="${round(r.top - pad * 0.6)}" width="${round(Math.max(box2.w, r.width) + pad * 2)}" height="${round(r.height * 0.92)}" rx="${round(pad)}" fill="${colour}" fill-opacity="0.12"/>` : interactive ? `<rect class="drawer-hit" x="${round(r.x - pad)}" y="${round(r.top - pad * 0.6)}" width="${round(box2.w + pad * 2)}" height="${round(r.height * 0.92)}" fill="transparent" pointer-events="all"/>` : "";
      const site = siteById(doc, r.siteId);
      const attrs = ` class="site-legend-row" data-site-id="${esc(r.siteId)}"${isSelected ? ' data-selected="true"' : ""}${interactive && site ? ` role="button" tabindex="0" aria-pressed="${isSelected}" aria-label="${esc(ariaFor ? ariaFor(site) : site.label)}"` : ""}`;
      return `<g${attrs}>${rect}<text x="${round(r.x)}" y="${round(r.y)}" font-size="${round(r.fontSize)}" font-weight="${isSelected ? 700 : 400}" fill="${isSelected ? colour : "#181818"}">${label}</text></g>`;
    });
    return `  <g class="site-legend">
    <text x="${round(h.x)}" y="${round(h.y)}" font-size="${round(h.fontSize)}" font-weight="700" fill="#181818">${esc(h.text)}</text>
    ${rows.join("\n    ")}
  </g>`;
  }
  function renderImages(doc, partTags) {
    return doc.images.filter((i) => i.visible !== false).map((i) => `<g class="image" data-image-id="${esc(i.id)}" data-image-name="${esc(i.name)}" transform="${imageTransform(i)}">${partTags?.has(i.id) ? tagPartElements(i.drawing.inner, partTags.get(i.id)) : i.drawing.inner}</g>`).join("");
  }
  function renderAreas(doc, state, areas) {
    const selected = new Set(state?.selectedAreaIds ?? []);
    const outlines = state?.areaOutlines ?? "always";
    const interactive = !!state?.interactive?.areas;
    const fs = fontSizeFor(doc.base.viewBox);
    const out = [];
    for (const area of areas) {
      const isSelected = selected.has(area.id);
      const colour = esc(state?.colors?.[area.id] || state?.selectedColor || DEFAULT_SELECTED_COLOR);
      if (area.shape.kind !== "part") {
        const show = outlines === "always" || outlines === "selected" && isSelected;
        const paint = isSelected ? `fill="${colour}" fill-opacity="0.32" stroke="${colour}" stroke-width="1.5" vector-effect="non-scaling-stroke"` : show ? 'fill="#ffffff" fill-opacity="0.18" stroke="#374151" stroke-width="1" vector-effect="non-scaling-stroke"' : 'fill="transparent" stroke="none"';
        const aria = interactive ? ` role="button" tabindex="0" aria-pressed="${isSelected}" aria-label="${esc(area.label)}"` : "";
        const attrs = `class="drawer-area" data-area-id="${esc(area.id)}"${area.fieldKey ? ` data-field-key="${esc(area.fieldKey)}"` : ""}${isSelected ? ' data-selected="true"' : ""}${aria} ${paint}${interactive ? ' pointer-events="all"' : ""}`;
        const shape = areaOutlineMarkup(doc, area, attrs);
        out.push(interactive ? shape.replace(/<(rect|ellipse|polygon)( [^>]*?)\/>/, (_m, tag, rest) => `<${tag}${rest}><title>${esc(area.label)}</title></${tag}>`) : shape);
      }
      if (state?.areaLabels) {
        const c = areaCenter(doc, area);
        out.push(`<text class="drawer-area-label" x="${round(c.x)}" y="${round(c.y)}" text-anchor="middle" dominant-baseline="central" font-size="${round(fs * 0.7)}" font-weight="700" fill="${isSelected ? colour : "#1f2937"}" pointer-events="none">${esc(area.label)}</text>`);
      }
    }
    return out.length ? `  <g class="drawer-areas">${out.join("")}</g>` : "";
  }
  function renderSvg(doc, opts = {}) {
    const state = opts.state;
    const surface = !!state || opts.showSiteMarkers === false || opts.showCallouts === false || opts.showTexts === false || opts.showGuides === false || opts.showSiteLegend === false || opts.mono !== void 0 || !!opts.frame;
    const view = doc.views.find((v) => v.id === (opts.viewId ?? doc.activeViewId)) ?? doc.views[0];
    let renderDoc = doc;
    if (state?.siteValues || opts.mono !== void 0) {
      const mappingValues = { ...doc.mappingValues ?? {} };
      if (state?.siteValues) {
        for (const site of doc.sites ?? []) {
          const v = state.siteValues[site.id];
          if (v === true) mappingValues[site.fieldKey] = "\u2713";
          else if (valueText(v)) mappingValues[site.fieldKey] = valueText(v);
          else delete mappingValues[site.fieldKey];
        }
      }
      renderDoc = {
        ...doc,
        mappingValues,
        views: doc.views.map((v) => v.id === view?.id && opts.mono !== void 0 ? { ...v, mono: opts.mono } : v)
      };
    }
    const all = resolveCallouts(renderDoc, opts.viewId);
    const resolved = surface ? all.filter((c) => c.siteId ? opts.showSiteMarkers !== false : opts.showCallouts !== false) : all;
    if (state?.emptyValueText !== void 0 && (view?.siteDisplay ?? "numbers") === "values") {
      for (const c of resolved) if (c.siteId && c.labelText === "\u2014") c.labelText = state.emptyValueText;
    }
    const selectedSites = new Set(state?.selectedSiteIds ?? []);
    if (state) {
      for (const c of resolved) {
        if (!c.siteId) continue;
        if (selectedSites.has(c.siteId)) c.color = state.colors?.[c.siteId] || state.selectedColor || DEFAULT_SELECTED_COLOR;
        else if (state.markerColor) c.color = state.markerColor;
      }
    }
    const fontSize = fontSizeFor(doc.base.viewBox);
    const texts = opts.showTexts === false ? [] : doc.textAnnotations.filter((t) => isImageVisible(doc, t.imageId));
    const guides = opts.showGuides === false ? [] : doc.drawingElements.filter((d) => isImageVisible(doc, d.imageId));
    const showSiteLegend = opts.showSiteLegend !== false;
    const wantLegend = (opts.includeLegend ?? doc.views.find((v) => v.id === (opts.viewId ?? doc.activeViewId))?.labelMode !== "names") && opts.showCallouts !== false;
    const legendItems = wantLegend ? buildLegend(renderDoc, opts.viewId).filter((l) => resolved.some((r) => r.index === l.index && !r.siteId)) : [];
    const legendLines = legendItems.flatMap((item) => item.name.replace(/\r\n?/g, "\n").split("\n"));
    const legendCount = legendLines.length + legendItems.length * 0.35;
    const longestLegendLine = Math.max(0, ...legendLines.map((line) => line.length + 3));
    const legendWidth = legendCount ? Math.max(fontSize * 12, longestLegendLine * fontSize * 0.85 * 0.66 + fontSize * 2) : 0;
    const frame = opts.frame ?? doc.exportFrame;
    let bounds = opts.viewBox ?? (frame === "page" && !legendCount ? { ...doc.base.viewBox } : computeBounds(doc, resolved, fontSize, legendWidth, legendCount, texts, guides, showSiteLegend));
    if (state?.legendValues && showSiteLegend && !opts.viewBox) {
      const right = Math.max(-Infinity, ...legendRows(doc, state).map((r) => r.x + r.width + r.fontSize * 0.5));
      if (right > bounds.x + bounds.w) bounds = { ...bounds, w: round(right - bounds.x) };
    }
    if (![bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite) || bounds.w <= 0 || bounds.h <= 0) {
      throw new Error("Invalid export viewBox.");
    }
    const bg = opts.background === null ? "" : `  <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="${esc(opts.background ?? "#ffffff")}"/>
`;
    const ariaFor = (site) => {
      const v = valueText(state?.siteValues?.[site.id]);
      const sel = selectedSites.has(site.id);
      return `${site.number}. ${site.label}${sel ? v ? `, ${v}` : ", selected" : ""}`;
    };
    const callouts = resolved.filter((c) => c.visible).map((c) => {
      const site = siteById(doc, c.siteId);
      return renderCallout(
        c,
        doc.anchors.find((a) => a.id === c.anchorId),
        doc.callouts.find((b) => b.id === c.id)?.labelText ?? c.labelText,
        fontSize,
        opts,
        site,
        state ? { selected: !!site && selectedSites.has(site.id), interactive: !!state.interactive?.sites, ariaLabel: site ? ariaFor(site) : void 0 } : void 0
      );
    }).join("\n");
    const legend = wantLegend ? renderLegend(renderDoc, bounds, fontSize, opts.viewId, legendWidth, legendItems) : "";
    const textAnnotations = texts.map(renderTextAnnotation).join("\n");
    const drawingElements = guides.map(renderDrawingElement).join("\n");
    const siteLegend = showSiteLegend ? renderSiteLegend(doc, state, ariaFor) : "";
    const areas = opts.showAreas === false ? [] : (doc.areas ?? []).filter((a) => isImageVisible(doc, a.imageId));
    let partTags;
    let stateStyle = "";
    let stateCss = "";
    if (state && areas.some((a) => a.shape.kind === "part")) {
      partTags = /* @__PURE__ */ new Map();
      const selectedAreas = new Set(state.selectedAreaIds ?? []);
      const rules = [];
      const scope = opts.rootId ? `#${opts.rootId} ` : "";
      for (const a of areas) {
        if (a.shape.kind !== "part" || !a.imageId) continue;
        const sel = selectedAreas.has(a.id);
        const aria = state.interactive?.areas ? ` role="button" tabindex="0" aria-pressed="${sel}" aria-label="${esc(a.label)}"` : "";
        const tags = partTags.get(a.imageId) ?? {};
        tags[a.shape.targetId] = `data-area-id="${esc(a.id)}"${sel ? ' data-selected="true"' : ""}${aria}`;
        partTags.set(a.imageId, tags);
        if (sel) {
          const colour = (state.colors?.[a.id] || state.selectedColor || DEFAULT_SELECTED_COLOR).replace(/[^#\w(),.%\s-]/g, "");
          rules.push(`${scope}[data-area-id="${a.id.replace(/["\\]/g, "")}"],${scope}[data-area-id="${a.id.replace(/["\\]/g, "")}"] *{fill:${colour}!important;fill-opacity:.45!important;stroke:${colour}!important}`);
        }
      }
      if (rules.length) {
        stateCss = rules.join("");
        if (!opts.externalStyle) stateStyle = `  <style><![CDATA[${stateCss}]]></style>
`;
      }
    }
    const areaMarkup = surface || areas.length ? renderAreas(doc, state, areas) : "";
    const marks = (state?.marks ?? []).filter((m) => isImageVisible(doc, m.imageId)).map((m) => markMarkup(doc, m)).join("");
    let connectionLines = "";
    const mode = state?.connections ?? "none";
    const layout = showSiteLegend ? siteLegendLayout(doc) : null;
    if (state && mode !== "none" && layout) {
      const rowBySite = new Map(layout.rows.map((r) => [r.siteId, r]));
      const wanted = (siteId) => mode === "all" || mode === "selected" && selectedSites.has(siteId) || mode === "active" && state.activeSiteId === siteId;
      const lines = [];
      for (const c of resolved) {
        if (!c.visible || !c.siteId || !wanted(c.siteId)) continue;
        const row = rowBySite.get(c.siteId);
        if (!row) continue;
        const end = { x: row.x - row.fontSize * 0.35, y: row.y - row.fontSize * 0.35 };
        lines.push(`<line class="drawer-connection" data-site-id="${esc(c.siteId)}" x1="${round(c.labelPos.x)}" y1="${round(c.labelPos.y)}" x2="${round(end.x)}" y2="${round(end.y)}" stroke="${esc(c.color)}" stroke-width="${round(Math.max(1.2, fontSize * 0.07))}" stroke-dasharray="${round(fontSize * 0.4)} ${round(fontSize * 0.3)}" stroke-opacity="0.75" pointer-events="none"/>`);
      }
      if (lines.length) connectionLines = `  <g class="drawer-connections">${lines.join("")}</g>`;
    }
    const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
    const width = Math.round(bounds.w * scale);
    const height = Math.round(bounds.h * scale);
    const size = opts.responsive ? ` width="100%" style="display:block;height:auto;max-width:100%"` : opts.scale ? ` width="${width}" height="${height}"` : "";
    const rootId = opts.rootId ? ` id="${esc(opts.rootId)}"` : "";
    const interactiveRoot = state?.interactive?.sites || state?.interactive?.areas;
    const role = state ? interactiveRoot ? ` role="group" aria-label="${esc(doc.name)}"` : ` role="img" aria-label="${esc(doc.name)}"` : "";
    const title = interactiveRoot ? "" : `  <title>${esc(doc.name)}</title>
`;
    const provenance = doc.provenance ? `  <metadata data-drawer-provenance="true">${esc(JSON.stringify(doc.provenance))}</metadata>
` : "";
    const prolog = opts.omitProlog ? "" : '<?xml version="1.0" encoding="UTF-8"?>\n';
    const svg = `${prolog}<svg xmlns="http://www.w3.org/2000/svg"${rootId} viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}"${size} font-family="${FONT_FAMILY}" data-generator="drawer" data-doc-name="${esc(doc.name)}"${state ? ` data-view-id="${esc(view?.id ?? "")}"` : ""}${role}>
${title}${provenance}${stateStyle}${bg}  <g class="body-layer">${doc.base.inner}${renderImages(doc, partTags)}</g>
${areaMarkup ? `${areaMarkup}
` : ""}${drawingElements}
${textAnnotations}
${connectionLines ? `${connectionLines}
` : ""}${siteLegend}
${callouts}
${legend}
${marks ? `  <g class="drawer-marks">${marks}</g>
` : ""}</svg>
`;
    return { svg, viewBox: bounds, width, height, css: stateCss };
  }

  // lib/drawer/sanitize.ts
  var NS2 = "http://www.w3.org/2000/svg";
  var LOCAL_REF2 = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;
  var RASTER_DATA2 = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/;
  function safePaint2(value) {
    if (/[\\<>]|\/\*|javascript\s*:|data\s*:|https?\s*:|@import|expression\s*\(/i.test(value)) return false;
    const remaining = value.replace(/url\(\s*(['"]?)(#[A-Za-z_][A-Za-z0-9_.:-]*)\1\s*\)/gi, "");
    return !/url\s*\(/i.test(remaining);
  }
  var BLOCKED = "script|style|title|foreignObject|iframe|object|embed|img|a|animate\\w*|set|audio|video|canvas";
  function sanitizeWithoutDom(markup) {
    return markup.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(new RegExp(`<\\s*(${BLOCKED})\\b[\\s\\S]*?(?:<\\/\\s*\\1\\s*>|\\/>)`, "gi"), "").replace(new RegExp(`<\\s*\\/?\\s*(${BLOCKED})\\b[^>]*>`, "gi"), "").replace(/\s(on[\w-]+|src|srcset|tabindex)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/<image\b[^>]*>/gi, (tag) => {
      const href = /\s(?:xlink:)?href\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? "";
      return RASTER_DATA2.test(href.trim()) ? tag : "";
    }).replace(/\s((?:xlink:)?href)\s*=\s*("([^"]*)"|'([^']*)')/gi, (match, _name, _quoted, dq, sq) => {
      const value = String(dq ?? sq ?? "").trim();
      return LOCAL_REF2.test(value) || RASTER_DATA2.test(value) ? match : "";
    }).replace(/\s([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (match, name, _quoted, dq, sq) => /^(xmlns|id|(xlink:)?href)$/.test(name) || safePaint2(String(dq ?? sq ?? "")) ? match : "");
  }
  function sanitizeDrawerMarkup(inner) {
    if (typeof DOMParser === "undefined" || typeof document === "undefined") return sanitizeWithoutDom(inner);
    const parsed = new DOMParser().parseFromString(`<svg xmlns="${NS2}">${inner}</svg>`, "image/svg+xml");
    if (parsed.querySelector("parsererror")) throw new Error("A drawing in this Drawer file is not valid SVG.");
    const root = parsed.documentElement;
    root.querySelectorAll("title").forEach((title) => title.remove());
    sanitizeSvgElement(root);
    return root.innerHTML.trim();
  }

  // lib/drawer/types.ts
  var DRAWER_PROVENANCE_KEYS = ["format", "fileName"];
  function readDrawerProvenance(value) {
    if (!value || typeof value !== "object") return void 0;
    const out = {};
    const take = (entries) => {
      for (const [key, entry] of Object.entries(entries)) if (typeof entry === "string") out[key] = entry.slice(0, 2e3);
    };
    const { notes, ...rest } = value;
    if (notes && typeof notes === "object") take(notes);
    take(rest);
    return Object.keys(out).length ? out : void 0;
  }
  function drawerSourceNotes(provenance) {
    const notes = Object.fromEntries(
      Object.entries(provenance ?? {}).filter(([key]) => !DRAWER_PROVENANCE_KEYS.includes(key))
    );
    return Object.keys(notes).length ? notes : void 0;
  }

  // lib/drawer/import.ts
  var DRAWER_PROJECT_FORMAT = "drawer-project";
  var DRAWER_SCENE_FORMAT = "drawer-scene";
  var MAX_FILE_CHARS = 32e6;
  var RESERVED_KEYS = ["__proto__", "prototype", "constructor"];
  var obj2 = (v, what) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`Invalid ${what}.`);
    return v;
  };
  var list2 = (v, what, max) => {
    if (v === void 0 || v === null) return [];
    if (!Array.isArray(v) || v.length > max) throw new Error(`Invalid ${what}; at most ${max} allowed.`);
    return v;
  };
  var num2 = (v, what, min = -1e5, max = 1e5) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`${what} must be a number from ${min} to ${max}.`);
    return v;
  };
  var text2 = (v, what, max = 2e3) => {
    if (typeof v !== "string" || v.length > max) throw new Error(`Invalid ${what}.`);
    return v;
  };
  var ident2 = (v) => {
    const s = text2(v, "ID", 120);
    if (!/^[A-Za-z][\w-]*$/.test(s)) throw new Error("Drawer IDs must begin with a letter and contain only letters, numbers, underscores or hyphens.");
    return s;
  };
  var unique2 = (ids, what) => {
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${what} IDs.`);
  };
  var color = (v, fallback) => typeof v === "string" && /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i.test(v.trim()) ? v.trim() : fallback;
  var vec = (v, what) => {
    const o = obj2(v, what);
    return { x: num2(o.x, `${what} x`), y: num2(o.y, `${what} y`) };
  };
  var box = (v, what, minSize = 0) => {
    const o = obj2(v, what);
    return { x: num2(o.x, `${what} x`), y: num2(o.y, `${what} y`), w: num2(o.w, `${what} width`, minSize), h: num2(o.h, `${what} height`, minSize) };
  };
  function drawerFileKind(value) {
    if (!value || typeof value !== "object") return null;
    const format = value.format;
    return format === DRAWER_PROJECT_FORMAT || format === DRAWER_SCENE_FORMAT ? format : null;
  }
  function importDrawerValue(value, fileName) {
    const kind = drawerFileKind(value);
    if (kind === DRAWER_SCENE_FORMAT) return sceneToDoc2(value, fileName);
    if (kind === DRAWER_PROJECT_FORMAT) return projectToDoc(value, fileName);
    throw new Error("This is not a Drawer file. Save a project (.drawer.json) or scene (.scene.json) from Drawer.");
  }
  function sceneDrawing(inner, width, height) {
    const viewBox = { x: 0, y: 0, w: width, h: height };
    return { inner: sanitizeDrawerMarkup(inner), viewBox, contentBox: { ...viewBox }, targetBoxes: {} };
  }
  function sceneToDoc2(input, fileName) {
    const scene = obj2(input, "scene");
    if (scene.format !== DRAWER_SCENE_FORMAT || scene.version !== 1) throw new Error("Expected a drawer-scene version 1 file.");
    if (JSON.stringify(input).length > MAX_FILE_CHARS) throw new Error("This Drawer file is too large.");
    const { mappingValues: _values, ...doc } = sceneToDoc(input, sceneDrawing);
    return {
      ...doc,
      provenance: { ...readDrawerProvenance(scene.provenance), format: DRAWER_SCENE_FORMAT, ...fileName ? { fileName } : {} }
    };
  }
  function validateSites(sites) {
    unique2(sites.map((s) => s.id), "site");
    if (new Set(sites.map((s) => s.number)).size !== sites.length) throw new Error("Site numbers must be unique.");
    if (new Set(sites.map((s) => s.fieldKey)).size !== sites.length) throw new Error("Each site needs a unique field key.");
  }
  function readDrawing(v, what, keepTargets) {
    const d = obj2(v, what);
    const viewBox = box(d.viewBox, `${what} viewBox`, 1e-6);
    const contentBox = d.contentBox ? box(d.contentBox, `${what} content box`) : { ...viewBox };
    const targetBoxes = {};
    if (d.targetBoxes && typeof d.targetBoxes === "object") {
      for (const [key, value] of Object.entries(d.targetBoxes)) {
        if (!keepTargets.has(key) || RESERVED_KEYS.includes(key)) continue;
        targetBoxes[key] = box(value, `${what} target ${key}`);
      }
    }
    return { inner: sanitizeDrawerMarkup(text2(d.inner ?? "", `${what} markup`, 6e6)), viewBox, contentBox, targetBoxes };
  }
  function readCallout(v) {
    const c = obj2(v, "callout");
    const shape = ["circle", "hex", "badge", "none"].find((s) => s === c.balloonShape) ?? "none";
    const leader = ["straight", "elbow", "none"].find((s) => s === c.leaderStyle) ?? "elbow";
    const marker = ["ring", "dot", "tick", "none"].find((s) => s === c.anchorMarker);
    const end = ["none", "arrow", "dot"].find((s) => s === c.leaderEnd);
    const weight = [400, 500, 600, 700].find((w) => w === c.fontWeight);
    const align = ["start", "middle", "end"].find((a) => a === c.labelAlign);
    return {
      id: ident2(c.id),
      anchorId: ident2(c.anchorId),
      labelText: text2(c.labelText ?? "", "callout label", 2e3),
      balloonShape: shape,
      balloonText: text2(c.balloonText ?? "", "balloon text", 40),
      leaderStyle: leader,
      ...marker ? { anchorMarker: marker } : {},
      ...end ? { leaderEnd: end } : {},
      ...typeof c.dashed === "boolean" ? { dashed: c.dashed } : {},
      labelPos: vec(c.labelPos, "callout label position"),
      elbow: c.elbow ? vec(c.elbow, "callout elbow") : null,
      color: color(c.color, "#111111"),
      ...c.leaderWidth !== void 0 ? { leaderWidth: num2(c.leaderWidth, "Leader width", 0, 50) } : {},
      ...c.fontSize !== void 0 ? { fontSize: num2(c.fontSize, "Font size", 1, 300) } : {},
      ...weight ? { fontWeight: weight } : {},
      ...c.labelOffset ? { labelOffset: vec(c.labelOffset, "callout label offset") } : {},
      ...align ? { labelAlign: align } : {},
      ...typeof c.siteId === "string" ? { siteId: ident2(c.siteId) } : {}
    };
  }
  function readAnchor(v) {
    const a = obj2(v, "anchor");
    const mode = ["relative-bbox", "absolute", "path-offset"].find((m) => m === a.mode);
    if (!mode) throw new Error("Invalid anchor mode.");
    const anchor = { id: ident2(a.id), mode };
    if (typeof a.imageId === "string") anchor.imageId = ident2(a.imageId);
    if (a.absolute) anchor.absolute = vec(a.absolute, "anchor point");
    if (a.relative) {
      const r = obj2(a.relative, "anchor position");
      anchor.relative = {
        targetId: typeof r.targetId === "string" && r.targetId ? text2(r.targetId, "anchor target", 200) : null,
        nx: num2(r.nx, "Anchor x", -100, 100),
        ny: num2(r.ny, "Anchor y", -100, 100)
      };
    }
    if (a.pathOffset) {
      const p = obj2(a.pathOffset, "anchor path offset");
      anchor.pathOffset = { targetId: text2(p.targetId, "anchor target", 200), t: num2(p.t, "Path offset", 0, 1) };
    }
    if (a.mapping) {
      const m = obj2(a.mapping, "anchor mapping");
      const fieldKey = text2(m.fieldKey, "mapping field key", 200);
      if (fieldKey && !RESERVED_KEYS.includes(fieldKey)) {
        anchor.mapping = {
          fieldKey,
          ...typeof m.display === "string" ? { display: text2(m.display, "mapping display", 240) } : {},
          ...typeof m.system === "string" ? { system: text2(m.system, "mapping system", 500) } : {},
          ...typeof m.code === "string" ? { code: text2(m.code, "mapping code", 200) } : {}
        };
      }
    }
    return anchor;
  }
  function readView(v) {
    const w = obj2(v, "view");
    const labelMode = ["names", "numbers", "blank"].find((m) => m === w.labelMode) ?? "names";
    const siteDisplay = ["numbers", "names", "values", "blank"].find((m) => m === w.siteDisplay);
    const mappingMode = ["label", "mapped-label", "value", "label-value"].find((m) => m === w.mappingMode);
    const overrides = {};
    for (const [id, raw] of Object.entries(w.overrides && typeof w.overrides === "object" ? w.overrides : {})) {
      if (RESERVED_KEYS.includes(id)) continue;
      const o = obj2(raw, "view override");
      const next = {};
      if (typeof o.visible === "boolean") next.visible = o.visible;
      if (o.labelPos) next.labelPos = vec(o.labelPos, "label position");
      if (o.labelOffset) next.labelOffset = vec(o.labelOffset, "label offset");
      if (typeof o.labelText === "string") next.labelText = text2(o.labelText, "label text");
      if (typeof o.balloonText === "string") next.balloonText = text2(o.balloonText, "balloon text", 40);
      const shape = ["circle", "hex", "badge", "none"].find((s) => s === o.balloonShape);
      if (shape) next.balloonShape = shape;
      const align = ["start", "middle", "end"].find((a) => a === o.labelAlign);
      if (align) next.labelAlign = align;
      if (o.elbow === null) next.elbow = null;
      else if (o.elbow) next.elbow = vec(o.elbow, "elbow");
      overrides[id] = next;
    }
    const view = { id: ident2(w.id), name: text2(w.name ?? "View", "view name", 240), labelMode, overrides };
    if (siteDisplay) view.siteDisplay = siteDisplay;
    if (mappingMode) view.mappingMode = mappingMode;
    if (typeof w.mono === "boolean") view.mono = w.mono;
    if (w.style && typeof w.style === "object") {
      const s = w.style;
      view.style = {
        balloonShape: ["circle", "hex", "badge", "none"].find((x) => x === s.balloonShape) ?? "none",
        leaderStyle: ["straight", "elbow", "none"].find((x) => x === s.leaderStyle) ?? "elbow",
        anchorMarker: ["ring", "dot", "tick", "none"].find((x) => x === s.anchorMarker) ?? "ring",
        leaderEnd: ["none", "arrow", "dot"].find((x) => x === s.leaderEnd) ?? "none",
        dashed: s.dashed === true,
        ...typeof s.leaderWidth === "number" ? { leaderWidth: num2(s.leaderWidth, "Leader width", 0, 50) } : {},
        ...typeof s.fontSize === "number" ? { fontSize: num2(s.fontSize, "Font size", 1, 300) } : {}
      };
    }
    return view;
  }
  function projectToDoc(input, fileName) {
    const file = obj2(input, "Drawer project");
    if (file.format !== DRAWER_PROJECT_FORMAT) throw new Error("Not a Drawer project file.");
    if (file.version !== 1) throw new Error("Unsupported Drawer project version.");
    const d = obj2(file.doc, "Drawer document");
    const anchors = list2(d.anchors, "anchors", 5e3).map(readAnchor);
    unique2(anchors.map((a) => a.id), "anchor");
    const rawAreas = list2(d.areas, "areas", 2e3).map(readArea);
    unique2(rawAreas.map((a) => a.id), "area");
    const targets = new Set([
      ...anchors.flatMap((a) => [a.relative?.targetId, a.pathOffset?.targetId]),
      ...rawAreas.map((a) => a.shape.kind === "part" ? a.shape.targetId : void 0)
    ].filter((t) => !!t));
    let base = readDrawing(d.base, "page", targets);
    let images = list2(d.images, "images", 200).map((raw) => {
      const i = obj2(raw, "image");
      return {
        id: ident2(i.id),
        name: text2(i.name ?? "Image", "image name", 240),
        drawing: readDrawing(i.drawing, "image", targets),
        x: num2(i.x, "Image x"),
        y: num2(i.y, "Image y"),
        width: num2(i.width, "Image width", 1e-6, 1e5),
        height: num2(i.height, "Image height", 1e-6, 1e5),
        rotation: num2(i.rotation ?? 0, "Rotation", -3600, 3600),
        ...i.flipX === true ? { flipX: true } : {},
        visible: i.visible !== false,
        ...i.locked === true ? { locked: true } : {},
        ...typeof i.source === "string" ? { source: text2(i.source, "image source", 1e3) } : {}
      };
    });
    unique2(images.map((i) => i.id), "image");
    if (base.inner.trim() && images.length === 0) {
      const vb = base.viewBox;
      images = [{ id: "image-base", name: text2(d.name ?? "Drawing", "name", 240), drawing: base, x: vb.x, y: vb.y, width: vb.w, height: vb.h, rotation: 0, visible: true }];
      for (const anchor of anchors) if (!anchor.imageId) anchor.imageId = "image-base";
      base = { inner: "", viewBox: { ...vb }, contentBox: { ...vb }, targetBoxes: {} };
    }
    const imageIds = new Set(images.map((i) => i.id));
    for (const anchor of anchors) if (anchor.imageId && !imageIds.has(anchor.imageId)) throw new Error("A point refers to a missing image.");
    const sites = list2(d.sites, "sites", 500).map((raw) => {
      const r = obj2(raw, "site");
      const number = num2(r.number, "Site number", 1, 9999);
      if (!Number.isInteger(number)) throw new Error("Site numbers must be whole numbers.");
      const fieldKey = text2(r.fieldKey, "field key", 200);
      if (!fieldKey.trim() || RESERVED_KEYS.includes(fieldKey)) throw new Error("Invalid field key.");
      return { id: ident2(r.id), number, label: text2(r.label ?? "", "site label", 240), fieldKey };
    });
    validateSites(sites);
    const siteIds = new Set(sites.map((s) => s.id));
    const anchorIds = new Set(anchors.map((a) => a.id));
    const callouts = list2(d.callouts, "callouts", 5e3).map(readCallout);
    unique2(callouts.map((c) => c.id), "callout");
    for (const callout of callouts) {
      if (!anchorIds.has(callout.anchorId)) throw new Error("A callout refers to a missing point.");
      if (callout.siteId && !siteIds.has(callout.siteId)) delete callout.siteId;
    }
    const views = list2(d.views, "views", 100).map(readView);
    if (!views.length) throw new Error("A Drawer project needs at least one view.");
    unique2(views.map((v) => v.id), "view");
    const textAnnotations = list2(d.textAnnotations, "text items", 1e3).map((raw) => {
      const t = obj2(raw, "text item");
      return {
        id: ident2(t.id),
        text: text2(t.text, "text"),
        pos: vec(t.pos, "text position"),
        style: t.style === "heading" ? "heading" : "plain",
        fontSize: num2(t.fontSize ?? 16, "Font size", 1, 300),
        fontWeight: t.fontWeight === 700 ? 700 : t.fontWeight === 600 ? 600 : 400,
        align: t.align === "middle" ? "middle" : t.align === "end" ? "end" : "start",
        color: color(t.color, "#111111"),
        ruleWidth: num2(t.ruleWidth ?? 0, "Rule width", 0, 1e5),
        ...typeof t.imageId === "string" && imageIds.has(t.imageId) ? { imageId: t.imageId } : {}
      };
    });
    const drawingElements = list2(d.drawingElements, "shapes", 2e3).map((raw) => {
      const e = obj2(raw, "shape");
      return {
        id: ident2(e.id),
        kind: e.kind === "rect" ? "rect" : "line",
        start: vec(e.start, "shape start"),
        end: vec(e.end, "shape end"),
        stroke: color(e.stroke, "#222222"),
        strokeWidth: num2(e.strokeWidth ?? 1, "Stroke width", 0, 200),
        dashed: e.dashed === true,
        fill: e.fill ? color(e.fill, "none") : null,
        ...typeof e.imageId === "string" && imageIds.has(e.imageId) ? { imageId: e.imageId } : {}
      };
    });
    let siteLegend;
    if (d.siteLegend) {
      const g = obj2(d.siteLegend, "site legend");
      siteLegend = {
        pos: vec(g.pos, "legend position"),
        heading: text2(g.heading ?? "Sites", "legend heading", 240),
        fontSize: num2(g.fontSize, "Legend font size", 4, 200),
        rowHeight: num2(g.rowHeight, "Legend row height", 4, 400),
        visible: g.visible !== false
      };
    }
    const areas = rawAreas.filter((a) => !a.imageId || imageIds.has(a.imageId));
    const areaIds = new Set(areas.map((a) => a.id));
    const groups = list2(d.groups, "groups", 500).map((raw) => {
      const g = obj2(raw, "group");
      const ids = (v, keep) => [...new Set(list2(v, "group members", 5e3).filter((x) => typeof x === "string" && keep.has(x)))];
      return {
        id: ident2(g.id),
        label: text2(g.label ?? "Group", "group label", 240),
        areaIds: ids(g.areaIds, areaIds),
        siteIds: ids(g.siteIds, siteIds),
        ...g.showCount === false ? { showCount: false } : {}
      };
    });
    unique2(groups.map((g) => g.id), "group");
    const activeViewId = typeof d.activeViewId === "string" && views.some((v) => v.id === d.activeViewId) ? d.activeViewId : views[0].id;
    return {
      id: ident2(d.id ?? "drawer-doc"),
      name: text2(d.name ?? fileName ?? "Drawer drawing", "name", 240),
      base,
      images,
      sites,
      ...siteLegend ? { siteLegend } : {},
      exportFrame: d.exportFrame === "page" ? "page" : "content",
      anchors,
      callouts,
      views,
      activeViewId,
      textAnnotations,
      drawingElements,
      ...areas.length ? { areas } : {},
      ...groups.length ? { groups } : {},
      // Drawer's landmark catalog is authoring-only; Webforms never renders it.
      landmarks: [],
      landmarkGroupOrder: [],
      hiddenLandmarkGroups: [],
      // A project's own source notes come across; Webforms records the format and file.
      provenance: { ...readDrawerProvenance(d.provenance), format: DRAWER_PROJECT_FORMAT, ...fileName ? { fileName } : {} }
    };
  }
  var finitePoint = (v, what) => vec(v, what);
  function readAreaShape(v) {
    const s = obj2(v, "area shape");
    switch (s.kind) {
      case "part":
        return { kind: "part", targetId: text2(s.targetId, "area part", 200) };
      case "rect":
        return { kind: "rect", x: num2(s.x, "Area x"), y: num2(s.y, "Area y"), w: num2(s.w, "Area width", 0), h: num2(s.h, "Area height", 0) };
      case "ellipse":
        return { kind: "ellipse", cx: num2(s.cx, "Area x"), cy: num2(s.cy, "Area y"), rx: num2(s.rx, "Area radius", 0), ry: num2(s.ry, "Area radius", 0) };
      case "polygon": {
        const points = list2(s.points, "area points", 2e3).map((p) => finitePoint(p, "area point"));
        if (points.length < 3) throw new Error("A polygon area needs at least three points.");
        return { kind: "polygon", points };
      }
      default:
        throw new Error("Unknown area shape.");
    }
  }
  function readArea(v) {
    const a = obj2(v, "area");
    const fieldKey = typeof a.fieldKey === "string" && a.fieldKey.trim() && !RESERVED_KEYS.includes(a.fieldKey) ? text2(a.fieldKey, "area field key", 200) : "";
    return {
      id: ident2(a.id),
      label: text2(a.label ?? "", "area label", 240),
      ...typeof a.imageId === "string" ? { imageId: ident2(a.imageId) } : {},
      shape: readAreaShape(a.shape),
      ...fieldKey ? { fieldKey } : {}
    };
  }

  // lib/drawer/svg.ts
  function renderDrawerSvg(doc, options = {}) {
    const interactive = options.interactive === true ? { sites: true, areas: true } : options.interactive || void 0;
    const hasState = !!(interactive || options.selectedSiteIds?.length || options.selectedAreaIds?.length || options.siteValues || options.marks?.length || options.markerColor || options.selectedColor || options.siteColors || options.connections || options.legendValues || options.emptyValueText !== void 0 || options.areaOutlines || options.areaLabels);
    const { provenance, ...drawing } = doc;
    const notes = drawerSourceNotes(provenance);
    const result = renderSvg(notes ? { ...drawing, provenance: notes } : drawing, {
      viewId: options.viewId || void 0,
      showSiteMarkers: options.showSiteMarkers,
      showCallouts: options.showCallouts,
      showTexts: options.showTexts,
      showGuides: options.showGuides,
      showSiteLegend: options.showSiteLegend,
      showAreas: options.showAreas,
      mono: options.mono,
      frame: options.frame,
      background: options.background,
      includeMetadata: options.includeMetadata,
      omitProlog: true,
      responsive: options.responsive,
      scale: options.responsive ? void 0 : options.scale ?? 1,
      rootId: options.rootId,
      externalStyle: options.externalStyle,
      state: hasState ? {
        selectedSiteIds: options.selectedSiteIds,
        selectedAreaIds: options.selectedAreaIds,
        colors: options.siteColors,
        selectedColor: options.selectedColor,
        markerColor: options.markerColor,
        siteValues: options.siteValues,
        legendValues: options.legendValues,
        emptyValueText: options.emptyValueText,
        marks: options.marks,
        activeSiteId: options.activeSiteId,
        connections: options.connections,
        areaOutlines: options.areaOutlines,
        areaLabels: options.areaLabels,
        interactive
      } : void 0
    });
    const svg = options.documentTitle === false ? result.svg.replace(/^(<svg\b[^>]*>\s*)<title>[^<]*<\/title>\s*/, "$1") : result.svg;
    return { ...result, svg: svg.trimEnd() };
  }
  function drawerSites(doc) {
    return sortedSites(doc);
  }
  function drawerMarkerCounts(doc) {
    const counts = {};
    for (const c of doc.callouts) if (c.siteId) counts[c.siteId] = (counts[c.siteId] ?? 0) + 1;
    return counts;
  }

  // lib/drawer/value.ts
  function normalizeValueOptions(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item;
      const value = typeof o.value === "string" ? o.value.trim() : typeof o.value === "number" ? String(o.value) : "";
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push({
        value,
        ...typeof o.label === "string" && o.label.trim() ? { label: o.label.trim() } : {},
        ...typeof o.color === "string" && /^#[0-9a-f]{3,8}$/i.test(o.color.trim()) ? { color: o.color.trim() } : {}
      });
    }
    return out;
  }
  var readAnswerMap = (raw, keep) => {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [id, value] of Object.entries(raw)) {
      if (!keep.has(id)) continue;
      if (value === true) out[id] = true;
      else if (typeof value === "string" && value) out[id] = value;
    }
    return out;
  };
  function readMarks(raw, doc) {
    if (!Array.isArray(raw)) return [];
    const images = new Set(doc.images.map((i) => i.id));
    const out = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const m = item;
      const points = Array.isArray(m.points) ? m.points.filter((p) => !!p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y)).map((p) => ({ x: p.x, y: p.y })) : [];
      const kind = m.kind === "stroke" ? "stroke" : "symbol";
      if (points.length < (kind === "stroke" ? 2 : 1)) continue;
      if (typeof m.imageId === "string" && !images.has(m.imageId)) continue;
      out.push({
        id: typeof m.id === "string" ? m.id : `mark_${out.length + 1}`,
        kind,
        ...kind === "symbol" ? { symbol: m.symbol === "circle" || m.symbol === "triangle" ? m.symbol : "x" } : {},
        ...typeof m.imageId === "string" ? { imageId: m.imageId } : {},
        points,
        color: typeof m.color === "string" && /^#[0-9a-f]{3,8}$/i.test(m.color) ? m.color : "#ef4444",
        size: Number.isFinite(m.size) && m.size > 0 ? m.size : 12,
        ...typeof m.areaId === "string" ? { areaId: m.areaId } : {},
        ...typeof m.siteId === "string" ? { siteId: m.siteId } : {}
      });
    }
    return out;
  }
  function readDrawerAnswers(stored, doc) {
    const siteIds = new Set((doc?.sites ?? []).map((s2) => s2.id));
    const areaIds = new Set((doc?.areas ?? []).map((a) => a.id));
    const empty = { sites: {}, areas: {}, marks: [] };
    if (!doc || !stored || typeof stored !== "object") return empty;
    const s = stored;
    const direct = s.choices && typeof s.choices === "object" ? s.choices : null;
    if (direct) return { sites: readAnswerMap(direct.sites, siteIds), areas: readAnswerMap(direct.areas, areaIds), marks: readMarks(s.marks, doc) };
    const sites = s.sites && typeof s.sites === "object" ? readAnswerMap(s.sites, siteIds) : Object.fromEntries((Array.isArray(s.selectedSiteIds) ? s.selectedSiteIds : []).filter((id) => typeof id === "string" && siteIds.has(id)).map((id) => [id, true]));
    const areas = s.areas && typeof s.areas === "object" ? readAnswerMap(s.areas, areaIds) : Object.fromEntries((Array.isArray(s.selectedIds) ? s.selectedIds : []).filter((id) => typeof id === "string" && areaIds.has(id)).map((id) => [id, true]));
    return { sites, areas, marks: readMarks(s.marks, doc) };
  }
  function readDrawerSiteAnswers(stored, doc) {
    return readDrawerAnswers(stored, doc).sites;
  }
  function buildDrawerDiagramValue(doc, answers, options = {}) {
    const full = "marks" in answers && "areas" in answers && "sites" in answers ? answers : { sites: answers, areas: {}, marks: [] };
    const choice = options.mode === "choice";
    const optionLabel = new Map((options.valueOptions ?? []).map((o) => [o.value, o.label || o.value]));
    const answered = (v) => choice ? typeof v === "string" && v !== "" : v === true || typeof v === "string" && v !== "";
    const siteAnswers = { ...full.sites };
    const areaAnswers = { ...full.areas };
    if (options.marksSelect && !choice) {
      for (const m of full.marks) {
        if (m.areaId && !areaAnswers[m.areaId]) areaAnswers[m.areaId] = true;
        if (m.siteId && !siteAnswers[m.siteId]) siteAnswers[m.siteId] = true;
      }
    }
    const areas = (doc.areas ?? []).filter((a) => answered(areaAnswers[a.id]));
    const sites = sortedSites(doc).filter((s) => answered(siteAnswers[s.id]));
    if (!areas.length && !sites.length && !full.marks.length) return null;
    const value = {
      sites: {},
      selectedSiteIds: [],
      areas: {},
      selectedIds: [],
      selectedLabels: [],
      selectedCount: areas.length + sites.length,
      byHotspot: Object.fromEntries((doc.areas ?? []).map((a) => [a.id, false])),
      countsByGroup: {},
      labelsByGroup: {},
      byFieldKey: {},
      marks: full.marks,
      markCount: full.marks.length,
      summary: ""
    };
    if (choice) value.labelsByFieldKey = {};
    const summary = [];
    const describe = (answer) => answer === true ? "" : optionLabel.get(answer) ?? answer;
    for (const area of areas) {
      const answer = choice ? String(areaAnswers[area.id]) : true;
      const label = area.label || area.id;
      value.areas[area.id] = answer;
      value.selectedIds.push(area.id);
      value.byHotspot[area.id] = true;
      const shown = describe(answer);
      value.selectedLabels.push(shown ? `${label}: ${shown}` : label);
      summary.push(shown ? `${label} (${shown})` : label);
      if (area.fieldKey) {
        value.byFieldKey[area.fieldKey] = answer;
        if (choice) value.labelsByFieldKey[area.fieldKey] = shown;
      }
    }
    for (const site of sites) {
      const answer = choice ? String(siteAnswers[site.id]) : true;
      value.sites[site.id] = answer;
      value.selectedSiteIds.push(site.id);
      value.byFieldKey[site.fieldKey] = answer;
      const shown = describe(answer);
      if (choice) value.labelsByFieldKey[site.fieldKey] = shown;
      value.selectedLabels.push(shown ? `${site.number}. ${site.label}: ${shown}` : `${site.number}. ${site.label}`);
      summary.push(shown ? `${site.label} (${shown})` : site.label);
    }
    if (options.marksSelect && !choice && full.marks.length) value.choices = { sites: { ...full.sites }, areas: { ...full.areas } };
    const groups = groupSelection(doc, value.selectedIds, value.selectedSiteIds);
    value.countsByGroup = groups.countsByGroup;
    value.labelsByGroup = groups.labelsByGroup;
    value.summary = summary.join("; ");
    return value;
  }

  // lib/drawer/index.ts
  function toDrawerDoc(value) {
    if (!value || typeof value !== "object") return null;
    if (drawerFileKind(value)) return importDrawerValue(value);
    const doc = value;
    if (!Array.isArray(doc.images) || !Array.isArray(doc.views)) return null;
    const read = projectToDoc({ format: DRAWER_PROJECT_FORMAT, version: 1, doc: value });
    const provenance = readDrawerProvenance(doc.provenance);
    return provenance ? { ...read, provenance } : read;
  }

  // lib/drawer/hotspot.ts
  var HOTSPOT_IMAGE_ID = "hotspot-image";
  var DEFAULT_MARKER_SIZE = 3;
  var DEFAULT_MARKER_RADIUS = 1.5;
  var SVG_MARGIN_PERCENT = 2;
  var clampPercent = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  };
  var str = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  var groupId = (value, fallback) => typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || fallback : fallback;
  function parsePoints(value) {
    const raw = typeof value === "string" ? value.trim().split(/\s+/).map((pair) => pair.split(",")).filter((p) => p.length >= 2).map(([x, y]) => ({ x, y })) : Array.isArray(value) ? value : [];
    return raw.filter((p) => !!p && typeof p === "object").map((p) => ({ x: clampPercent(p.x), y: clampPercent(p.y) }));
  }
  function normalizeHotspots(hotspots, markerSize = DEFAULT_MARKER_SIZE) {
    if (!Array.isArray(hotspots)) return [];
    const used = /* @__PURE__ */ new Set();
    const out = [];
    hotspots.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") return;
      const base = str(raw.id, `hotspot_${index + 1}`);
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
      used.add(id);
      const shapeName = str(raw.shape, "rect").toLowerCase();
      const shape = shapeName === "polygon" ? "polygon" : shapeName === "circle" ? "circle" : "rect";
      const h = {
        id,
        label: str(raw.label, id),
        shape,
        x: clampPercent(raw.x),
        y: clampPercent(raw.y),
        width: markerSize,
        height: markerSize,
        radius: Math.max(DEFAULT_MARKER_RADIUS, markerSize / 2),
        fieldId: str(raw.fieldId),
        group: str(raw.group)
      };
      if (shape === "circle") {
        const r = clampPercent(raw.radius != null ? raw.radius : markerSize / 2 || DEFAULT_MARKER_RADIUS);
        h.radius = r > 0 ? r : DEFAULT_MARKER_RADIUS;
      } else if (shape === "polygon") {
        let points = parsePoints(raw.points);
        if (points.length < 3) {
          const half = Math.max(0.5, markerSize / 2);
          points = [
            { x: clampPercent(h.x - half), y: clampPercent(h.y - half) },
            { x: clampPercent(h.x + half), y: clampPercent(h.y - half) },
            { x: clampPercent(h.x + half), y: clampPercent(h.y + half) },
            { x: clampPercent(h.x - half), y: clampPercent(h.y + half) }
          ];
        }
        h.points = points;
        h.x = points.reduce((s, p) => s + p.x, 0) / points.length;
        h.y = points.reduce((s, p) => s + p.y, 0) / points.length;
      } else {
        const w = clampPercent(raw.width != null ? raw.width : markerSize);
        const hh = clampPercent(raw.height != null ? raw.height : markerSize);
        h.width = w > 0 ? w : markerSize;
        h.height = hh > 0 ? hh : markerSize;
      }
      out.push(h);
    });
    return out;
  }
  function normalizeCounterGroups(counterGroups, hotspots) {
    const known = new Set(hotspots.map((h) => h.id));
    if (Array.isArray(counterGroups)) {
      const used = /* @__PURE__ */ new Set();
      return counterGroups.flatMap((g, index) => {
        if (!g || typeof g !== "object") return [];
        const base = groupId(g.id, `group_${index + 1}`);
        let id = base;
        for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
        used.add(id);
        const member = (h) => known.has(str(h)) ? str(h) : groupId(h, "");
        const members = Array.isArray(g.hotspotIds) ? [...new Set(g.hotspotIds.map(member).filter((h) => h && known.has(h)))] : [];
        return [{ id, label: str(g.label, id), areaIds: members, siteIds: [], ...g.showCounter === false ? { showCount: false } : {} }];
      });
    }
    const byGroup = /* @__PURE__ */ new Map();
    for (const h of hotspots) {
      if (!h.group) continue;
      const id = groupId(h.group, `group_${byGroup.size + 1}`);
      if (!byGroup.has(id)) byGroup.set(id, { id, label: h.group, areaIds: [], siteIds: [] });
      byGroup.get(id).areaIds.push(h.id);
    }
    return [...byGroup.values()];
  }
  function normalizeNumberFields(value) {
    if (!Array.isArray(value)) return [];
    const used = /* @__PURE__ */ new Set();
    return value.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const base = groupId(item.id, `number_field_${index + 1}`);
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
      used.add(id);
      const width = Number(item.width);
      const num3 = (v) => Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : void 0;
      const step = num3(item.step);
      return [{
        id,
        fieldId: str(item.fieldId ?? item.field_id, id),
        label: str(item.label),
        x: clampPercent(item.x),
        y: clampPercent(item.y),
        width: Number.isFinite(width) ? Math.max(6, Math.min(40, width)) : 12,
        placeholder: str(item.placeholder),
        min: num3(item.min),
        max: num3(item.max),
        step: step && step > 0 ? step : void 0
      }];
    });
  }
  function readSvgFrame(markup) {
    const open = /<svg\b([^>]*)>/i.exec(markup);
    const close = markup.toLowerCase().lastIndexOf("</svg>");
    if (!open || close < 0) return null;
    const attrs = open[1];
    const attr = (name) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs)?.[1] ?? new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, "i").exec(attrs)?.[1];
    const inner = markup.slice(open.index + open[0].length, close);
    const vb = (attr("viewBox") ?? "").split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) return { inner, x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    const w = parseFloat(attr("width") ?? "");
    const h = parseFloat(attr("height") ?? "");
    return { inner, x: 0, y: 0, w: w > 0 ? w : 100, h: h > 0 ? h : 100 };
  }
  function fillSvgText(inner, values) {
    let out = inner;
    for (const [textId, value] of Object.entries(values)) {
      const re = new RegExp(`(<text\\b[^>]*\\sid="${textId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>)([\\s\\S]*?)(</text>)`);
      out = out.replace(re, (_m, open, body, end) => {
        const anchored = /\stext-anchor=/.test(open) ? open : open.replace(/>$/, ' text-anchor="middle">');
        const safe = value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const filled = /<tspan\b/.test(body) ? body.replace(/(<tspan\b[^>]*>)[\s\S]*?(<\/tspan>)/, `$1${safe}$2`) : safe;
        return `${anchored}${filled}${end}`;
      });
    }
    return out;
  }
  function svgTextIds(markup) {
    return new Set([...markup.matchAll(/<text\b[^>]*\sid="([^"]+)"/g)].map((m) => m[1]));
  }
  var RASTER_HREF = /^(?:data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+|https:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/;
  function hotspotSurface(input) {
    const markerSize = Number(input.markerSize) > 0 ? Number(input.markerSize) : DEFAULT_MARKER_SIZE;
    const svg = typeof input.imageSvg === "string" && /<svg[\s>]/i.test(input.imageSvg) ? readSvgFrame(input.imageSvg) : null;
    let frame;
    let inner;
    let margin = 0;
    let textIds = /* @__PURE__ */ new Set();
    if (svg) {
      frame = svg;
      textIds = svgTextIds(svg.inner);
      inner = sanitizeDrawerMarkup(input.textValues ? fillSvgText(svg.inner, input.textValues) : svg.inner);
      margin = SVG_MARGIN_PERCENT / 100;
    } else {
      const href = str(input.imageUrl);
      const size = input.rasterSize;
      if (!href || !RASTER_HREF.test(href) || !size || !(size.width > 0 && size.height > 0)) return null;
      frame = { x: 0, y: 0, w: size.width, h: size.height };
      inner = `<image href="${href.replace(/"/g, "&quot;")}" x="0" y="0" width="${size.width}" height="${size.height}" preserveAspectRatio="none"/>`;
    }
    const W = frame.w;
    const H = frame.h;
    const toImage = (p) => ({ x: frame.x + p.x / 100 * W, y: frame.y + p.y / 100 * H });
    const toPercent = (p) => ({ x: (p.x - frame.x) / W * 100, y: (p.y - frame.y) / H * 100 });
    const hotspots = normalizeHotspots(input.hotspots, markerSize);
    const areas = hotspots.map((h) => {
      const base = { id: h.id, label: h.label, imageId: HOTSPOT_IMAGE_ID, ...h.fieldId ? { fieldKey: h.fieldId } : {} };
      if (h.shape === "circle") {
        const c = toImage({ x: h.x, y: h.y });
        const r = h.radius / 100 * W;
        return { ...base, shape: { kind: "ellipse", cx: c.x, cy: c.y, rx: r, ry: r } };
      }
      if (h.shape === "polygon") return { ...base, shape: { kind: "polygon", points: (h.points ?? []).map(toImage) } };
      const tl = toImage({ x: h.x, y: h.y });
      return { ...base, shape: { kind: "rect", x: tl.x, y: tl.y, w: h.width / 100 * W, h: h.height / 100 * H } };
    });
    const groups = normalizeCounterGroups(input.counterGroups, hotspots);
    const padX = W * margin;
    const padY = H * margin;
    const page = { x: 0, y: 0, w: W + padX * 2, h: H + padY * 2 };
    const doc = {
      id: "hotspot-map",
      name: str(input.imageAlt, "Map"),
      base: { inner: "", viewBox: page, contentBox: { ...page }, targetBoxes: {} },
      images: [{
        id: HOTSPOT_IMAGE_ID,
        name: str(input.imageAlt, "Map"),
        drawing: { inner, viewBox: { x: frame.x, y: frame.y, w: W, h: H }, contentBox: { x: frame.x, y: frame.y, w: W, h: H }, targetBoxes: {} },
        x: padX,
        y: padY,
        width: W,
        height: H,
        rotation: 0,
        visible: true
      }],
      sites: [],
      exportFrame: "page",
      anchors: [],
      callouts: [],
      views: [{ id: "map", name: "Map", labelMode: "names", overrides: {} }],
      activeViewId: "map",
      textAnnotations: [],
      drawingElements: [],
      areas,
      groups,
      landmarks: [],
      landmarkGroupOrder: [],
      hiddenLandmarkGroups: [],
      provenance: { format: "hotspot-map" }
    };
    return {
      doc,
      hotspots,
      toImage,
      toPercent,
      lengthToImage: (percent) => percent / 100 * W,
      lengthToPercent: (units) => units / W * 100,
      toPage: (p) => {
        const q = toImage(p);
        return { x: q.x - frame.x + padX, y: q.y - frame.y + padY };
      },
      width: page.w,
      textIds
    };
  }
  function annotationsToMarks(annotations, surface, defaults) {
    if (!Array.isArray(annotations)) return [];
    const out = [];
    annotations.forEach((a, index) => {
      if (!a || typeof a !== "object") return;
      const stroke = a.type === "stroke" || a.type === void 0 && Array.isArray(a.points);
      const size = Number(a.size) > 0 ? Math.max(0.5, Math.min(20, Number(a.size))) : defaults.size;
      const color2 = str(a.color, defaults.color);
      const id = str(a.id, `annotation_${index + 1}`);
      if (stroke) {
        const points = parsePoints(a.points).map(surface.toImage);
        if (points.length >= 2) out.push({ id, kind: "stroke", imageId: HOTSPOT_IMAGE_ID, points, color: color2, size: surface.lengthToImage(size) });
        return;
      }
      const symbol = a.symbol === "circle" || a.symbol === "triangle" || a.symbol === "x" ? a.symbol : defaults.symbol;
      out.push({ id, kind: "symbol", symbol, imageId: HOTSPOT_IMAGE_ID, points: [surface.toImage({ x: clampPercent(a.x), y: clampPercent(a.y) })], color: color2, size: surface.lengthToImage(size) });
    });
    return out;
  }
  function marksToAnnotations(marks, surface) {
    const pct = (p) => {
      const q = surface.toPercent(p);
      return { x: clampPercent(q.x), y: clampPercent(q.y) };
    };
    return marks.map((m) => m.kind === "stroke" ? { id: m.id, type: "stroke", color: m.color, size: surface.lengthToPercent(m.size), points: m.points.map(pct) } : { id: m.id, type: "symbol", ...pct(m.points[0]), symbol: m.symbol ?? "x", color: m.color, size: surface.lengthToPercent(m.size) });
  }
  function toHotspotValue(value, surface, now = () => (/* @__PURE__ */ new Date()).toISOString()) {
    if (!value) return null;
    const annotations = marksToAnnotations(value.marks, surface);
    if (!value.selectedIds.length && !annotations.length) return null;
    const selectedLabels = value.selectedIds.map((id) => surface.hotspots.find((h) => h.id === id)?.label ?? id);
    const ungrouped = !(surface.doc.groups ?? []).length;
    return {
      selectedIds: value.selectedIds,
      selectedLabels,
      selectedCount: value.selectedIds.length,
      byHotspot: value.byHotspot,
      countsByGroup: ungrouped ? selectedLabels.length ? { default: selectedLabels.length } : {} : value.countsByGroup,
      labelsByGroup: ungrouped ? selectedLabels.length ? { default: selectedLabels } : {} : value.labelsByGroup,
      annotations,
      annotationCount: annotations.length,
      updatedAt: now()
    };
  }
  return __toCommonJS(runtime_exports);
})();

// DrawerDiagramField — a drawing made in Drawer (github.com/ahzs645/drawer) as
// a selection surface on a form.
//
// One drawing, three kinds of target, any of them live at once:
//   areas  regions you select — a named part of the artwork or a shape drawn
//          over it (a joint, a zone)
//   sites  numbered points you mark, possibly on several images (Drawer's
//          site table), with its legend and views
//   marks  an X / circle / triangle placed where you click, or a freehand
//          stroke; a mark on an area or site can count as selecting it
//
//   mode "select"  click to tick an area or site
//   mode "choice"  click, then pick a value (e.g. a stage) for it
//   mode "image"   display only; nothing is stored
//
// It renders through DrawerRuntime.renderDrawerSvg — Drawer's own exporter,
// bundled from the vendor/drawer submodule — so the form shows exactly what
// Drawer exports. Answers: lib/drawer/value.ts. HotspotMapField renders
// through this component (DrawerDiagramField.runtime + the __ props).
const DrawerDiagramField = ({
  id,
  fieldId = id || "drawerDiagram",
  label = "",
  helperText = "",
  drawerDocument = null,
  mode = "select",
  multiple = true,
  valueOptions = [],
  targets,
  markTools = ["x", "circle", "triangle"],
  markColor = "#ef4444",
  markSize,
  marksSelect = true,
  viewId = "",
  allowViewSwitch = false,
  showSiteLegend = true,
  showCallouts = true,
  showTexts = true,
  showGuides = true,
  mono,
  frame,
  connections = "selected",
  areaOutlines = "always",
  areaLabels = false,
  selectedColor = "",
  markerColor = "",
  legendValues = true,
  showSummary = true,
  showCounts = true,
  showSiteTable = false,
  inputs = [],
  maxWidth = 900,
  openInModal = false,
  modalButtonText = "Open diagram",
  modalTitle = "",
  modalMinWidth = 960,
  imageAlt = "",
  siteFieldIds = {},
  areaFieldIds = {},
  selectedCountFieldId = "",
  selectedIdsFieldId = "",
  selectedLabelsFieldId = "",
  summaryFieldId = "",
  required = false,
  readOnly = false,
  disabled = false,
  // Internal (HotspotMapField): a prebuilt document and value adapters.
  __doc = null,
  __readValue = null,
  __writeValue = null,
  __renderSummary = null,
  __frameStyle = null,
  __panelStyle = null,
}) => {
  const { useMemo, useState, useRef, useEffect, useCallback } = React
  // Inside a SubformScoring dialog the answers live in its isolated session
  // (FormSessionRuntime); outside one this is useActiveData.
  const useFormData = typeof useFormSessionData === "function" ? useFormSessionData : useActiveData
  const [fd, setFd] = useFormData()
  const sd = typeof useSourceData === "function" ? useSourceData() : null
  const [viewChoice, setViewChoice] = useState("")
  const [active, setActive] = useState(null) // { kind: "site" | "area", id }
  const [modalOpen, setModalOpen] = useState(false)
  const [tool, setTool] = useState("")
  const [draft, setDraft] = useState(null) // stroke being drawn: { page: [] }
  const focusRef = useRef(null)
  const frameRef = useRef(null)
  const drawRef = useRef(null)

  const loaded = useMemo(() => {
    if (__doc) return { doc: __doc, error: "" }
    try {
      return { doc: DrawerRuntime.toDrawerDoc(drawerDocument), error: "" }
    } catch (error) {
      return { doc: null, error: error && error.message ? error.message : "This drawing could not be read." }
    }
  }, [drawerDocument, __doc])
  const doc = loaded.doc
  const isImage = mode === "image"
  const options = useMemo(() => DrawerRuntime.normalizeValueOptions(valueOptions), [valueOptions])
  const choice = mode === "choice" && options.length > 0
  const signed = sd?.webform?.recordState === "SIGNED" || sd?.webform?.isDraft === "N"
  const locked = isImage || readOnly || disabled || signed
  const live = {
    sites: !isImage && (!targets || targets.sites !== false),
    areas: !isImage && (!targets || targets.areas !== false),
    marks: !isImage && !!(targets && targets.marks),
  }
  const sites = useMemo(() => (doc ? DrawerRuntime.drawerSites(doc) : []), [doc])
  const areas = doc && doc.areas ? doc.areas : []
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites])
  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas])
  const markerCounts = useMemo(() => (doc ? DrawerRuntime.drawerMarkerCounts(doc) : {}), [doc])
  const symbolTools = (Array.isArray(markTools) ? markTools : []).filter((t) => t === "x" || t === "circle" || t === "triangle")
  const canDraw = Array.isArray(markTools) && markTools.includes("draw")
  const selectable = (live.sites && sites.length > 0) || (live.areas && areas.length > 0)
  const activeTool = live.marks && !locked ? (tool || (selectable ? "select" : symbolTools[0] || (canDraw ? "draw" : "select"))) : "select"

  const stored = fd?.field?.data?.[fieldId]
  const answers = useMemo(() => {
    if (isImage || !doc) return { sites: {}, areas: {}, marks: [] }
    return __readValue ? __readValue(stored, doc) : DrawerRuntime.readDrawerAnswers(stored, doc)
  }, [stored, doc, isImage, __readValue])
  const marksSelectOn = live.marks && marksSelect !== false
  const buildOptions = useMemo(
    () => ({ mode: choice ? "choice" : "select", valueOptions: options, marksSelect: marksSelectOn }),
    [choice, options, marksSelectOn]
  )
  const preview = useMemo(
    () => (doc ? DrawerRuntime.buildDrawerDiagramValue(doc, answers, buildOptions) : null),
    [doc, answers, buildOptions]
  )
  const selectedSiteIds = preview ? preview.selectedSiteIds : []
  const selectedAreaIds = preview ? preview.selectedIds : []
  const optionByValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options])
  const colors = useMemo(() => {
    const out = {}
    if (!choice) return out
    for (const map of [answers.sites, answers.areas]) {
      for (const [targetId, answer] of Object.entries(map)) {
        const option = optionByValue.get(String(answer))
        if (option && option.color) out[targetId] = option.color
      }
    }
    return out
  }, [answers, optionByValue, choice])
  const siteValues = useMemo(() => {
    const values = {}
    for (const [siteId, answer] of Object.entries(answers.sites)) {
      values[siteId] = answer === true ? true : (optionByValue.get(String(answer))?.label || String(answer))
    }
    return values
  }, [answers, optionByValue])

  const views = doc ? doc.views : []
  const effectiveViewId = (allowViewSwitch && viewChoice) || viewId || (doc ? doc.activeViewId : "")
  const scopeClass = `wf-drawer-${String(fieldId).replace(/[^A-Za-z0-9_-]/g, "_")}`

  const rendered = useMemo(() => {
    if (!doc) return null
    try {
      return DrawerRuntime.renderDrawerSvg(doc, {
        // No hover tooltip over the whole picture; the frame's aria-label names it.
        documentTitle: false,
        viewId: effectiveViewId,
        showSiteLegend: showSiteLegend !== false,
        showCallouts: showCallouts !== false,
        showTexts: showTexts !== false,
        showGuides: showGuides !== false,
        mono: typeof mono === "boolean" ? mono : undefined,
        frame: frame === "page" || frame === "content" ? frame : undefined,
        selectedSiteIds,
        selectedAreaIds,
        siteValues,
        siteColors: colors,
        legendValues: legendValues !== false && !isImage,
        emptyValueText: "",
        selectedColor: selectedColor || DrawerRuntime.DEFAULT_SELECTED_COLOR,
        markerColor: markerColor || undefined,
        activeSiteId: active && active.kind === "site" ? active.id : null,
        connections: isImage ? "none" : connections,
        marks: isImage ? [] : answers.marks,
        areaOutlines,
        areaLabels: !!areaLabels,
        interactive: locked || activeTool !== "select" ? false : { sites: live.sites, areas: live.areas },
        responsive: true,
        rootId: `${scopeClass}-svg`,
        externalStyle: true,
      })
    } catch (error) {
      return { error: error && error.message ? error.message : "This drawing could not be drawn." }
    }
  }, [doc, effectiveViewId, showSiteLegend, showCallouts, showTexts, showGuides, mono, frame, selectedSiteIds, selectedAreaIds,
    siteValues, colors, legendValues, isImage, selectedColor, markerColor, active, connections, answers.marks, areaOutlines,
    areaLabels, locked, activeTool, live.sites, live.areas, scopeClass])

  // Keep keyboard focus on the same target after a redraw. preventScroll: in
  // SMOIS the form scrolls in its own container and focus() would jump it.
  useEffect(() => {
    const target = focusRef.current
    const root = frameRef.current
    if (!target || !root) return
    focusRef.current = null
    const selector = target.calloutId
      ? `[data-callout-id="${target.calloutId}"]`
      : target.kind === "area"
        ? `[data-area-id="${target.id}"][role="button"]`
        : `.site-legend-row[data-site-id="${target.id}"]`
    const element = root.querySelector(selector)
    if (element && typeof element.focus === "function") element.focus({ preventScroll: true })
  }, [rendered])

  const commit = useCallback((next) => {
    if (locked || !setFd || !doc) return
    const value = DrawerRuntime.buildDrawerDiagramValue(doc, next, buildOptions)
    const storedValue = __writeValue ? __writeValue(value, next) : value
    setFd(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data) draft.field.data = {}
      const data = draft.field.data
      data[fieldId] = storedValue
      const ids = value ? [...value.selectedIds, ...value.selectedSiteIds] : []
      if (selectedCountFieldId) data[selectedCountFieldId] = value ? value.selectedCount : 0
      if (summaryFieldId) data[summaryFieldId] = value ? value.summary : ""
      if (selectedIdsFieldId) data[selectedIdsFieldId] = ids.join(",")
      if (selectedLabelsFieldId) data[selectedLabelsFieldId] = value ? value.selectedLabels.join(", ") : ""
      const writeBack = (map, answersMap, known) => {
        for (const [targetId, targetFieldId] of Object.entries(map || {})) {
          if (!targetFieldId || !known.has(targetId)) continue
          const answer = answersMap[targetId]
          data[targetFieldId] = choice ? (typeof answer === "string" ? answer : "") : !!answer
        }
      }
      writeBack(siteFieldIds, value ? value.sites : {}, siteById)
      writeBack(areaFieldIds, value ? value.areas : {}, areaById)
    }))
  }, [locked, setFd, doc, buildOptions, choice, fieldId, selectedCountFieldId, summaryFieldId, selectedIdsFieldId,
    selectedLabelsFieldId, siteFieldIds, areaFieldIds, siteById, areaById, __writeValue])

  const setAnswer = useCallback((kind, targetId, answer) => {
    const key = kind === "area" ? "areas" : "sites"
    const next = { sites: { ...answers.sites }, areas: { ...answers.areas }, marks: answers.marks }
    if (!multiple) {
      next.sites = {}
      next.areas = {}
    }
    if (answer === null || answer === undefined || answer === false || answer === "") delete next[key][targetId]
    else next[key][targetId] = answer
    commit(next)
  }, [answers, multiple, commit])

  const activateTarget = useCallback((kind, targetId) => {
    const known = kind === "area" ? areaById : siteById
    if (locked || !known.has(targetId)) return
    setActive({ kind, id: targetId })
    if (!choice) {
      const shown = (kind === "area" ? selectedAreaIds : selectedSiteIds).includes(targetId)
      setAnswer(kind, targetId, shown ? null : true)
    }
  }, [locked, areaById, siteById, choice, selectedAreaIds, selectedSiteIds, setAnswer])

  // --- pointer -> drawing coordinates, for marks ---------------------------
  const svgElement = () => (frameRef.current ? frameRef.current.querySelector("svg") : null)
  const toPage = (event) => {
    const svg = svgElement()
    if (!svg || typeof svg.getScreenCTM !== "function" || !svg.createSVGPoint) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const p = point.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }
  const imageAt = (page) => {
    const list = doc ? [...doc.images].reverse() : []
    for (const image of list) {
      if (image.visible === false) continue
      const local = DrawerRuntime.pageToImage(image, page)
      const vb = image.drawing.viewBox
      if (local.x >= vb.x && local.x <= vb.x + vb.w && local.y >= vb.y && local.y <= vb.y + vb.h) return { image, local }
    }
    return { image: null, local: page }
  }
  const targetsAt = (clientX, clientY, page) => {
    let areaId
    let siteId
    if (typeof document !== "undefined" && typeof document.elementsFromPoint === "function") {
      for (const element of document.elementsFromPoint(clientX, clientY)) {
        if (!frameRef.current || !frameRef.current.contains(element) || !element.closest) continue
        const areaEl = !areaId ? element.closest("[data-area-id]") : null
        if (areaEl && !areaEl.classList.contains("drawer-mark")) areaId = areaEl.getAttribute("data-area-id")
        const siteEl = !siteId ? element.closest(".site-marker[data-site-id]") : null
        if (siteEl) siteId = siteEl.getAttribute("data-site-id")
      }
    }
    if (!areaId && doc) {
      const hit = DrawerRuntime.areasAtPoint(doc, page)
      if (hit.length) areaId = hit[0].id
    }
    return { areaId: areaId && areaById.has(areaId) ? areaId : undefined, siteId: siteId && siteById.has(siteId) ? siteId : undefined }
  }
  const pageSize = rendered && rendered.viewBox ? Math.max(rendered.viewBox.w, rendered.viewBox.h) : 1000
  const markPageSize = Number(markSize) > 0 ? Number(markSize) : pageSize * 0.022
  const addMark = (mark) => commit({ sites: answers.sites, areas: answers.areas, marks: [...answers.marks, mark] })
  const newMarkId = () => `mark_${Date.now().toString(36)}_${answers.marks.length + 1}`

  const onTargetActivate = (event) => {
    const element = event.target && event.target.closest ? event.target.closest('[role="button"][data-site-id], [role="button"][data-area-id]') : null
    if (!element) return
    if (event.type === "keydown") {
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
    }
    const areaId = element.getAttribute("data-area-id")
    if (areaId) {
      focusRef.current = { kind: "area", id: areaId }
      activateTarget("area", areaId)
      return
    }
    const siteId = element.getAttribute("data-site-id")
    focusRef.current = { kind: "site", id: siteId, calloutId: element.getAttribute("data-callout-id") || "" }
    activateTarget("site", siteId)
  }
  const onSurfaceClick = (event) => {
    if (locked) return
    if (activeTool === "select") {
      onTargetActivate(event)
      return
    }
    if (!symbolTools.includes(activeTool)) return
    const page = toPage(event)
    if (!page) return
    const { image, local } = imageAt(page)
    const scale = image ? DrawerRuntime.imageScale(doc, image.id) : 1
    const hit = targetsAt(event.clientX, event.clientY, page)
    addMark({
      id: newMarkId(),
      kind: "symbol",
      symbol: activeTool,
      ...(image ? { imageId: image.id } : {}),
      points: [local],
      color: markColor || "#ef4444",
      size: markPageSize / scale,
      ...(hit.areaId ? { areaId: hit.areaId } : {}),
      ...(hit.siteId ? { siteId: hit.siteId } : {}),
    })
  }
  const onSurfaceFocus = (event) => {
    const element = event.target && event.target.closest ? event.target.closest('[data-site-id][role="button"]') : null
    if (!element || connections !== "active") return
    focusRef.current = { kind: "site", id: element.getAttribute("data-site-id"), calloutId: element.getAttribute("data-callout-id") || "" }
    setActive({ kind: "site", id: element.getAttribute("data-site-id") })
  }

  // freehand strokes: drawn on a light overlay, committed on release
  const onPointerDown = (event) => {
    if (locked || activeTool !== "draw" || (typeof event.button === "number" && event.button !== 0)) return
    const page = toPage(event)
    if (!page) return
    event.preventDefault()
    if (event.currentTarget.setPointerCapture) {
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch (error) { /* no-op */ }
    }
    const { image, local } = imageAt(page)
    drawRef.current = { pointerId: event.pointerId, image, clientX: event.clientX, clientY: event.clientY, start: page, page: [page], local: [local] }
    setDraft({ page: [page] })
  }
  const onPointerMove = (event) => {
    const d = drawRef.current
    if (!d || d.pointerId !== event.pointerId) return
    const page = toPage(event)
    if (!page) return
    const last = d.page[d.page.length - 1]
    if (Math.abs(last.x - page.x) + Math.abs(last.y - page.y) < pageSize * 0.002) return
    d.page.push(page)
    d.local.push(d.image ? DrawerRuntime.pageToImage(d.image, page) : page)
    setDraft({ page: [...d.page] })
  }
  const onPointerUp = (event) => {
    const d = drawRef.current
    if (!d || d.pointerId !== event.pointerId) return
    drawRef.current = null
    setDraft(null)
    if (d.local.length < 2) return
    const scale = d.image ? DrawerRuntime.imageScale(doc, d.image.id) : 1
    const hit = targetsAt(d.clientX, d.clientY, d.start)
    addMark({
      id: newMarkId(),
      kind: "stroke",
      ...(d.image ? { imageId: d.image.id } : {}),
      points: d.local,
      color: markColor || "#ef4444",
      size: markPageSize / scale,
      ...(hit.areaId ? { areaId: hit.areaId } : {}),
      ...(hit.siteId ? { siteId: hit.siteId } : {}),
    })
  }

  const css = `.${scopeClass} [role="button"][data-site-id],.${scopeClass} [role="button"][data-area-id]{cursor:pointer;outline:none}`
    + `.${scopeClass} [data-site-id][role="button"]:hover .drawer-balloon{opacity:.82}`
    + `.${scopeClass} .site-legend-row[role="button"]:hover text{text-decoration:underline}`
    + `.${scopeClass} [data-site-id][role="button"]:focus-visible .drawer-hit{fill:rgba(0,120,212,.10);stroke:#0078d4;stroke-width:2px;vector-effect:non-scaling-stroke}`
    + `.${scopeClass} [data-area-id][role="button"]:hover,.${scopeClass} [data-area-id][role="button"]:focus-visible{filter:drop-shadow(0 0 1.5px #0078d4) drop-shadow(0 0 1.5px #0078d4)}`

  const activeTarget = active ? (active.kind === "area" ? areaById.get(active.id) : siteById.get(active.id)) : null
  const answerFor = (kind, targetId) => (kind === "area" ? answers.areas : answers.sites)[targetId]
  const targetName = (kind, target) => (kind === "area" ? target.label || target.id : `${target.number}. ${target.label}`)

  const renderPicker = () => {
    if (!choice || locked || !activeTarget) return null
    const current = answerFor(active.kind, active.id)
    return (
      <div role="group" aria-label={`Value for ${activeTarget.label || activeTarget.id}`} data-drawer-picker={active.id}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "8px 10px", border: "1px solid #c8c6c4", borderRadius: 4, background: "#faf9f8" }}>
        <span style={{ fontWeight: 600, marginRight: 4 }}>{targetName(active.kind, activeTarget)}</span>
        {options.map((option) => {
          const isCurrent = current === option.value
          const Button = isCurrent ? Fluent.PrimaryButton : Fluent.DefaultButton
          return (
            <Button key={option.value} text={option.label || option.value} aria-pressed={isCurrent}
              onClick={() => setAnswer(active.kind, active.id, isCurrent ? null : option.value)}
              styles={option.color ? { root: { borderLeft: `6px solid ${option.color}` } } : undefined} />
          )
        })}
        <Fluent.DefaultButton text="Clear" disabled={!current} onClick={() => setAnswer(active.kind, active.id, null)} />
        <Fluent.DefaultButton text="Done" onClick={() => setActive(null)} />
      </div>
    )
  }

  const renderMarkTools = () => {
    if (!live.marks || locked || (!symbolTools.length && !canDraw)) return null
    const labels = { select: "Select", x: "✕ Mark", circle: "◯ Mark", triangle: "△ Mark", draw: "✎ Draw" }
    const tools = [...(selectable ? ["select"] : []), ...symbolTools, ...(canDraw ? ["draw"] : [])]
    return (
      <div role="toolbar" aria-label="Drawing tools" data-drawer-tools={fieldId} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {tools.map((t) => {
          const Button = activeTool === t ? Fluent.PrimaryButton : Fluent.DefaultButton
          return <Button key={t} text={labels[t]} aria-pressed={activeTool === t} onClick={() => setTool(t)} />
        })}
        <Fluent.DefaultButton text="Undo mark" disabled={!answers.marks.length}
          onClick={() => commit({ sites: answers.sites, areas: answers.areas, marks: answers.marks.slice(0, -1) })} />
        <Fluent.DefaultButton text="Clear marks" disabled={!answers.marks.length}
          onClick={() => commit({ sites: answers.sites, areas: answers.areas, marks: [] })} />
      </div>
    )
  }

  const renderTable = () => {
    if (!showSiteTable || isImage) return null
    const rows = [
      ...(live.areas ? areas.map((area) => ({ kind: "area", target: area })) : []),
      ...(live.sites ? sites.map((site) => ({ kind: "site", target: site })) : []),
    ]
    if (!rows.length) return null
    return (
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }} data-drawer-site-table={fieldId}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #c8c6c4" }}>{live.areas && areas.length ? "Area / site" : "Site"}</th>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #c8c6c4" }}>{choice ? "Value" : "Marked"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ kind, target }) => {
            const answer = answerFor(kind, target.id)
            return (
              <tr key={`${kind}:${target.id}`} data-site-row={kind === "site" ? target.id : undefined} data-area-row={kind === "area" ? target.id : undefined}>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #edebe9" }}>
                  {targetName(kind, target)}
                  {kind === "site" && markerCounts[target.id] > 1 ? <span style={{ color: "#605e5c" }}>{` (on ${markerCounts[target.id]} drawings)`}</span> : null}
                </td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #edebe9" }}>
                  {choice ? (
                    <Fluent.Dropdown ariaLabel={`Value for ${target.label || target.id}`} disabled={locked}
                      selectedKey={typeof answer === "string" ? answer : "__none__"}
                      options={[{ key: "__none__", text: "—" }, ...options.map((option) => ({ key: option.value, text: option.label || option.value }))]}
                      onChange={(_event, option) => setAnswer(kind, target.id, option && option.key !== "__none__" ? String(option.key) : null)} />
                  ) : (
                    <Fluent.Checkbox ariaLabel={`Mark ${target.label || target.id}`} disabled={locked}
                      checked={(kind === "area" ? selectedAreaIds : selectedSiteIds).includes(target.id)}
                      onChange={(_event, checked) => setAnswer(kind, target.id, checked ? true : null)} />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const renderSummary = () => {
    if (isImage) return null
    if (__renderSummary) return __renderSummary({ value: preview, answers })
    const counts = showCounts !== false && doc ? DrawerRuntime.countedGroups(doc) : []
    const lines = []
    if (showSummary) {
      const count = preview ? preview.selectedCount : 0
      lines.push(count
        ? <div key="summary"><b>{`${count} selected: `}</b>{preview.summary}</div>
        : <div key="summary" style={{ color: "#605e5c" }}>Nothing marked.</div>)
      if (live.marks && answers.marks.length) lines.push(<div key="marks">{`Marks: ${answers.marks.length}`}</div>)
    }
    for (const group of counts) {
      lines.push(<div key={group.id}>{`${group.label}: `}<b>{preview ? preview.countsByGroup[group.id] || 0 : 0}</b></div>)
    }
    if (!lines.length) return null
    return <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }} data-drawer-summary={preview ? String(preview.selectedCount) : ""}>{lines}</div>
  }

  const renderViewSwitch = () => {
    if (!allowViewSwitch || views.length < 2) return null
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }} role="group" aria-label="Show sites as">
        <span style={{ fontSize: 13, color: "#605e5c" }}>Show:</span>
        {views.map((view) => {
          const current = view.id === effectiveViewId
          const Button = current ? Fluent.PrimaryButton : Fluent.DefaultButton
          return <Button key={view.id} text={view.name} aria-pressed={current} onClick={() => setViewChoice(view.id)} />
        })}
      </div>
    )
  }

  const inputValue = (input) => {
    const value = fd?.field?.data?.[input.fieldId]
    if (value == null) return ""
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
    return String(value)
  }
  const writeInput = (input, raw) => {
    if (locked || !setFd || !input.fieldId) return
    const trimmed = String(raw ?? "").trim()
    let next = null
    if (trimmed) {
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed)) {
        next = parsed
        if (typeof input.min === "number") next = Math.max(input.min, next)
        if (typeof input.max === "number") next = Math.min(input.max, next)
      } else {
        next = String(raw)
      }
    }
    setFd(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data) draft.field.data = {}
      draft.field.data[input.fieldId] = next
    }))
  }

  const renderDiagram = () => {
    if (loaded.error) return <div role="alert" style={{ color: "#a4262c" }}>{loaded.error}</div>
    if (!doc) return <div style={{ padding: 12, border: "1px dashed #c8c6c4", color: "#605e5c" }}>No Drawer drawing selected. Import one in the builder.</div>
    if (!rendered || rendered.error) return <div role="alert" style={{ color: "#a4262c" }}>{rendered ? rendered.error : ""}</div>
    const vb = rendered.viewBox
    const pct = (value, origin, size) => `${((value - origin) / size) * 100}%`
    return (
      <div className={scopeClass} data-drawer-diagram={fieldId}
        style={{ position: "relative", width: "100%", maxWidth: Number(maxWidth) > 0 ? Number(maxWidth) : undefined, border: "1px solid #edebe9", background: "#fff",
          cursor: activeTool === "select" ? undefined : "crosshair", touchAction: activeTool === "draw" ? "none" : undefined, ...(__frameStyle || {}) }}
        onClick={locked ? undefined : onSurfaceClick}
        onKeyDown={locked ? undefined : onTargetActivate}
        onFocus={locked ? undefined : onSurfaceFocus}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}>
        <div ref={frameRef} role={isImage ? "img" : "group"} aria-label={imageAlt || doc.name}
          style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: rendered.svg }} />
        {draft && draft.page.length > 1 ? (
          <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            <polyline points={draft.page.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={markColor || "#ef4444"}
              strokeWidth={Math.max(1, markPageSize / 4.5)} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
          </svg>
        ) : null}
        {(Array.isArray(inputs) ? inputs : []).map((input) => (
          <div key={input.id} data-drawer-input={input.id}
            style={{ position: "absolute", left: pct(input.x, vb.x, vb.w), top: pct(input.y, vb.y, vb.h), transform: "translate(-50%, -50%)",
              width: `${((Number(input.width) || vb.w * 0.12) / vb.w) * 100}%`, minWidth: input.takeover ? 20 : 56, maxWidth: input.takeover ? 180 : 220,
              display: "flex", flexDirection: "column", gap: 2, lineHeight: 1.1 }}
            onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            {input.label && !input.takeover ? <span style={{ fontSize: 10, color: "#334155", textShadow: "0 0 2px rgba(255,255,255,0.7)" }}>{input.label}</span> : null}
            <input type={input.takeover ? "text" : "number"} inputMode="decimal" aria-label={input.label || input.id}
              value={inputValue(input)} onChange={(event) => writeInput(input, event.target.value)}
              min={input.min} max={input.max} step={input.step} placeholder={input.placeholder || undefined} disabled={locked}
              style={{ width: "100%", textAlign: "center", outline: "none", borderRadius: input.takeover ? 0 : 4,
                border: input.takeover ? "none" : "1px solid #cbd5e1", padding: input.takeover ? 0 : "3px 6px",
                fontSize: input.takeover ? 14 : 12, fontWeight: input.takeover ? 700 : 400,
                background: input.takeover ? "transparent" : "#ffffff", color: input.takeover ? "transparent" : "#111827",
                caretColor: input.takeover ? "#111827" : undefined }} />
          </div>
        ))}
      </div>
    )
  }

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <style>{css + (rendered && rendered.css ? rendered.css : "")}</style>
      {renderViewSwitch()}
      {renderMarkTools()}
      {renderDiagram()}
      {renderPicker()}
      {renderSummary()}
      {renderTable()}
    </div>
  )

  return (
    <div data-drawer-diagram-field={fieldId} style={{ margin: "8px 0", display: "flex", flexDirection: "column", gap: 6, ...(__panelStyle || {}) }}>
      {label ? <Fluent.Label required={required && !isImage}>{label}</Fluent.Label> : null}
      {helperText ? <div style={{ fontSize: 12, color: "#605e5c" }}>{helperText}</div> : null}
      {openInModal ? (
        <>
          <div><Fluent.PrimaryButton text={modalButtonText || "Open diagram"} onClick={() => setModalOpen(true)} disabled={!doc} /></div>
          {renderSummary()}
          <Fluent.Dialog hidden={!modalOpen} onDismiss={() => setModalOpen(false)}
            dialogContentProps={{ title: modalTitle || label || (doc ? doc.name : "Diagram") }}
            minWidth={DialogKit.width(Number(modalMinWidth) || 960, 960)} maxWidth={DialogKit.maxWidth}
            modalProps={{ isBlocking: false }}>
            {body}
            <Fluent.DialogFooter>
              <Fluent.PrimaryButton text="Done" onClick={() => setModalOpen(false)} />
            </Fluent.DialogFooter>
          </Fluent.Dialog>
        </>
      ) : body}
    </div>
  )
}

// Shared with HotspotMapField (reference inside function bodies only: NHForms
// component files load in no guaranteed order).
DrawerDiagramField.runtime = DrawerRuntime
