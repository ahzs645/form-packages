import { fetchSmartStyle } from "@webforms/cerner-core";
import type React from "react";
import { useEffect, useState } from "react";

/**
 * The EHR's suggested look, as CSS custom properties for the player's root.
 *
 * `smart_style_url` in the token response names a small JSON document of the
 * host's colours, fonts and sizing (see cerner-core/smart-style). We set what
 * it asks for as `--smart-*` properties on our own root element and let the
 * stylesheet decide what to do with them — every rule reads
 * `var(--smart-…, <our default>)`, so a launch with no style document, an
 * unreachable one or a malformed one renders exactly as the player does on
 * its own. Nothing here reports a failure; there is nothing a user could do
 * about the EHR's style document, and our own look is a correct result.
 */

/** One shared empty object, so "no style" never re-renders a consumer. */
const NO_STYLE: React.CSSProperties = {};

export function useSmartStyle(url: string | null): React.CSSProperties {
  const [style, setStyle] = useState<React.CSSProperties>(NO_STYLE);

  useEffect(() => {
    if (!url) {
      setStyle(NO_STYLE);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    void fetchSmartStyle(url, { signal: controller.signal }).then((properties) => {
      if (cancelled) return;
      // CSS custom properties are not part of React's CSSProperties type, but
      // the DOM accepts them on the style attribute.
      setStyle(
        Object.keys(properties).length
          ? (properties as unknown as React.CSSProperties)
          : NO_STYLE,
      );
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  return style;
}
