import React from "react";

/** Stand-in for terra-icon/IconInformation; the icon package is 1.37 MB for 1,646 files. */
const IconInformation: React.FC<{ a11yLabel?: string; className?: string }> = ({ a11yLabel, className }) => (
  <span className={className} role={a11yLabel ? "img" : undefined} aria-label={a11yLabel} aria-hidden={a11yLabel ? undefined : true}>
    &#9888;
  </span>
);

export default IconInformation;
