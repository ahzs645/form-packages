// LayoutKit — shared responsive field and subgroup widths.
// Generated from packages/form-model/src/responsive-layout.ts; run pnpm generate:nhforms after changing it.
// Reference only inside function bodies: NHForms modules load in any order.

const LayoutKit = (() => {
  function fieldWidthFraction(width) {
    if (typeof width === "number") return Number.isFinite(width) ? Math.max(0.1, Math.min(1, width)) : 1;
    const [a, b] = (width ?? "").split("/").map(Number);
    return a > 0 && b > 0 ? Math.min(1, a / b) : 1;
  }
  function responsiveFieldStyle(fraction = 1, gap = 12, minWidth = 160) {
    const share = Number.isFinite(fraction) ? Math.max(0.1, Math.min(1, fraction)) : 1;
    const spacing = Number.isFinite(gap) ? Math.max(0, gap) : 12;
    const minimum = Number.isFinite(minWidth) ? Math.max(0, minWidth) : 160;
    const width = share === 1 ? "100%" : `min(100%, max(${minimum}px, calc((100% + ${spacing}px) * ${share} - ${spacing}px)))`;
    return { width, flexBasis: width, flexGrow: 0, flexShrink: 0, minWidth: 0, maxWidth: "100%" };
  }

  return {
    fieldWidthFraction,
    responsiveFieldStyle,
  }
})()
