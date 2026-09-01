import React from "react";

/**
 * terra-icon/IconVideoCamera, inlined. Only the icons our components reference are
 * vendored; the full package is 1.37 MB across 1,646 files.
 *
 * Sized in `em` and filled with `currentColor`, matching terra-icon's
 * IconBase, so an icon inherits the size and colour of surrounding text.
 */
const IconVideoCamera: React.FC<{ a11yLabel?: string; className?: string }> = ({ a11yLabel, className }) => (
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
    <path d="M48 10.9v26.3l-10-10v-6.3l10-10zm-13 .4C35 10 34 9 32.7 9H2.3C1 9 0 10 0 11.3v25.4C0 38 1 39 2.3 39h30.4c1.3 0 2.3-1 2.3-2.3V11.3z"></path>
  </svg>
);

export default IconVideoCamera;
