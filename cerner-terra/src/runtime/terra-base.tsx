import React from "react";

import "./terra-base.scss";

/**
 * Applies terra-base to the document for as long as a Terra tree is mounted.
 *
 * Terra authors every dimension in `rem`, and terra-base is what makes those
 * resolve correctly: it sets `font-size: 87.5%` on `html`, giving the 14px
 * root the whole scale assumes. Without it a 1.142857rem input renders at
 * 18.29px instead of 16px — everything is 16/14 too large — and, because
 * terra-base is also where `box-sizing: border-box` is normalised, padded
 * elements overflow their declared widths.
 *
 * It has to touch the document: `rem` resolves against the root element, so
 * scoping the font-size to a container cannot work. But it must not be
 * unconditional either — the player renders MOIS forms through Fluent on the
 * same document, and in a Cerner Component slot the page belongs to the host.
 * So the generated stylesheet is scoped to `html.terra-base` and this
 * component adds that class only while it is mounted.
 *
 * `dir` is set for the same reason: Terra scopes much of its CSS under
 * `[dir=ltr]`/`[dir=rtl]` and expects terra-base to have stamped it.
 *
 * Nesting is safe — the class is reference-counted, so an inner instance
 * unmounting does not strip the base from an outer one.
 */

let mountCount = 0;
let priorDir: string | null = null;

export const TerraBase: React.FC<{ children?: React.ReactNode; dir?: "ltr" | "rtl" }> = ({
  children,
  dir = "ltr",
}) => {
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    if (mountCount === 0) {
      priorDir = root.getAttribute("dir");
      root.classList.add("terra-base");
      root.setAttribute("dir", dir);
    }
    mountCount += 1;
    return () => {
      mountCount -= 1;
      if (mountCount === 0) {
        root.classList.remove("terra-base");
        if (priorDir === null) root.removeAttribute("dir");
        else root.setAttribute("dir", priorDir);
      }
    };
  }, [dir]);

  return <>{children}</>;
};

export default TerraBase;
