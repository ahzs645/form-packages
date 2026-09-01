import React from "react";

/**
 * terra-icon/IconGapChecking, inlined. Only the icons our components reference are
 * vendored; the full package is 1.37 MB across 1,646 files.
 *
 * Sized in `em` and filled with `currentColor`, matching terra-icon's
 * IconBase, so an icon inherits the size and colour of surrounding text.
 */
const IconGapChecking: React.FC<{ a11yLabel?: string; className?: string }> = ({ a11yLabel, className }) => (
  <svg
    className={className}
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    focusable="false"
    style={{ display: "inline-block", verticalAlign: "-0.15em", fill: "currentColor" }}
    role={a11yLabel ? "img" : "presentation"}
    aria-label={a11yLabel}
  >
    {a11yLabel ? <title>{a11yLabel}</title> : null}
    <path d="m46 15.1-2.7-5.5-16.5 9.6V0h-5.5v19.2L4.8 9.6l-2.7 5.5L17.8 24 2 32.9l2.7 5.5 16.5-9.6V48h5.5V28.8l16.5 9.6 2.7-5.5L30.2 24 46 15.1z"></path>
  </svg>
);

export default IconGapChecking;
