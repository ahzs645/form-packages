import React from "react";

/**
 * terra-icon/IconSuccess, inlined. Only the icons our components reference are
 * vendored; the full package is 1.37 MB across 1,646 files.
 *
 * Sized in `em` and filled with `currentColor`, matching terra-icon's
 * IconBase, so an icon inherits the size and colour of surrounding text.
 */
const IconSuccess: React.FC<{ a11yLabel?: string; className?: string }> = ({ a11yLabel, className }) => (
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
    <path fill="#78C346" d="M24 0c13.3 0 24 10.7 24 24S37.3 48 24 48 0 37.3 0 24C0 10.8 10.7 0 23.9 0h.1z"></path><path fill="#FFF" d="M20 36.4 6.7 23.1l3.6-3.6 9.7 9.9 17.7-17.9 3.6 3.6L20 36.4z"></path>
  </svg>
);

export default IconSuccess;
