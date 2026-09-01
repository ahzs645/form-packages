import React from "react";

/**
 * terra-icon/IconAudio, inlined. Only the icons our components reference are
 * vendored; the full package is 1.37 MB across 1,646 files.
 *
 * Sized in `em` and filled with `currentColor`, matching terra-icon's
 * IconBase, so an icon inherits the size and colour of surrounding text.
 */
const IconAudio: React.FC<{ a11yLabel?: string; className?: string }> = ({ a11yLabel, className }) => (
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
    <path d="M29 0v48L15 34H0V14h15L29 0zm6.3 12.7-2.1 2.1c2.3 2.3 3.8 5.6 3.8 9.2 0 3.6-1.5 6.8-3.8 9.2l2.1 2.1C38.2 32.4 40 28.4 40 24s-1.8-8.4-4.7-11.3zM41 7l-2.1 2.1C42.6 13 45 18.2 45 24c0 5.8-2.4 11-6.2 14.8L41 41c4.3-4.3 7-10.3 7-17s-2.7-12.6-7-17z"></path>
  </svg>
);

export default IconAudio;
