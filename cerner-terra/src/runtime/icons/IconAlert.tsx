import React from "react";

/**
 * terra-icon/IconAlert, inlined. Only the icons our components reference are
 * vendored; the full package is 1.37 MB across 1,646 files.
 *
 * Sized in `em` and filled with `currentColor`, matching terra-icon's
 * IconBase, so an icon inherits the size and colour of surrounding text.
 */
const IconAlert: React.FC<{ a11yLabel?: string; className?: string }> = ({ a11yLabel, className }) => (
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
    <path fill="#E50000" d="M1.2 45c-1.1 0-1.6-.8-1-1.7L23 3.7c.5-1 1.4-1 2 0l22.8 39.6c.5 1 .1 1.7-1 1.7H1.2z"></path><path fill="#FFF" d="M21.5 36.7h5V42h-5v-5.3zm0-22.7h5v17.3h-5V14z"></path>
  </svg>
);

export default IconAlert;
