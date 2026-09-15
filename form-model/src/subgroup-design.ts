/** Opt-in container design. Missing/original preserves legacy/source layout. */
export interface SubgroupDesign {
  mode: "original" | "stacked" | "inline" | "row" | "columns";
  /** Relative column weights, e.g. [2, 1, 3]. */
  columns?: number[];
  /** Fraction of the parent's width. Missing means a full row. */
  width?: number;
  /** Cap the group's outer width in pixels; it can shrink with its parent. */
  maxWidth?: number;
  breakBefore?: boolean;
  gap?: number;
  padding?: number;
  align?: "start" | "center" | "end" | "stretch";
  /** Extra space in a stretched vertical stack: keep at top, spread apart, or grow its last child. */
  verticalFill?: "start" | "space-between" | "last";
  /** Compact captions to their text height and set the gap above the answer. Omitted preserves original spacing. */
  labelGap?: number;
  /** Override direct children's labels without changing their saved field settings. */
  labelPosition?: "inherit" | "top" | "left";
}

export function normalizeSubgroupDesign(design?: SubgroupDesign) {
  const clamp = (n: number | undefined, fallback: number, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  const columns = Array.isArray(design?.columns) ? design.columns.slice(0, 4).map(n => clamp(n, 1, 0.1, 100)) : undefined;
  return {
    mode: design && ["original", "stacked", "inline", "row", "columns"].includes(design.mode) ? design.mode : "original" as SubgroupDesign["mode"],
    columns: columns?.length ? columns : [1, 1],
    width: clamp(design?.width, 1, 0.1, 1),
    maxWidth: typeof design?.maxWidth === "number" && Number.isFinite(design.maxWidth) && design.maxWidth > 0 ? clamp(design.maxWidth, 1, 1, 10000) : undefined,
    breakBefore: design?.breakBefore === true,
    gap: clamp(design?.gap, 12, 0, 100),
    padding: clamp(design?.padding, 0, 0, 100),
    align: design && ["start", "center", "end", "stretch"].includes(design.align ?? "") ? design.align! : "start" as NonNullable<SubgroupDesign["align"]>,
    verticalFill: design && ["space-between", "last"].includes(design.verticalFill ?? "") ? design.verticalFill! : "start" as NonNullable<SubgroupDesign["verticalFill"]>,
    labelGap: typeof design?.labelGap === "number" && Number.isFinite(design.labelGap) ? clamp(design.labelGap, 4, 0, 100) : undefined,
    labelPosition: design && ["top", "left"].includes(design.labelPosition ?? "") ? design.labelPosition! : "inherit" as NonNullable<SubgroupDesign["labelPosition"]>,
  };
}

export function subgroupDesignEqual(a?: SubgroupDesign, b?: SubgroupDesign): boolean {
  return JSON.stringify(normalizeSubgroupDesign(a)) === JSON.stringify(normalizeSubgroupDesign(b));
}

export function subgroupWidthFraction(width?: string | number): number {
  if (typeof width === "number") return Math.max(0.1, Math.min(1, width));
  const [a, b] = (width ?? "").split("/").map(Number);
  return a > 0 && b > 0 ? Math.min(1, a / b) : 1;
}

/** Same row packing for native geometry and web wrappers. */
export function planSubgroupRows<T extends { width?: number; breakBefore?: boolean }>(items: T[], design: SubgroupDesign) {
  const d = normalizeSubgroupDesign(design);
  if (d.mode === "row") {
    // Fit every child in one row. Existing widths become relative proportions;
    // unlike inline flow, full-width fields cannot force another row.
    const weights = items.map(item => typeof item.width === "number" && Number.isFinite(item.width) && item.width > 0 ? item.width : 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return items.length ? [items.map((item, index) => ({ item, fraction: weights[index] / total }))] : [];
  }
  const rows: Array<Array<{ item: T; fraction: number }>> = [];
  let used = 0;
  for (const item of items) {
    const row = rows.at(-1);
    const slot = row?.length ?? 0;
    const fraction = d.mode === "stacked" ? 1 : d.mode === "columns"
      ? d.columns[(slot >= d.columns.length || item.breakBefore) ? 0 : slot] / d.columns.reduce((a,b) => a+b, 0)
      : item.width ?? 1;
    if (!row || item.breakBefore || d.mode === "stacked" || (d.mode === "columns" ? slot >= d.columns.length : used + fraction > 1.00001)) {
      rows.push([]);
      used = 0;
    }
    rows.at(-1)!.push({ item, fraction });
    used += fraction;
  }
  return rows;
}
