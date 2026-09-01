import { initializeIcons } from "@fluentui/react/lib/Icons";
import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { App } from "./App";

/**
 * Workflow-component packaging: one custom element the host page drops in.
 *
 *   <webforms-player title="Web Forms" path="https://host/custom_mpage_content/webforms-player"
 *                    form-id="demo" theme="cerner">
 *
 * Cerner's component framework renders exactly `title` and `path` (see
 * custom-components.js in the domain's static content), and carries patient
 * context in the *host page's* query string (pId/eId/uId) rather than on our
 * element — resolveChartContext reads both. person_id/encntr_id attributes
 * still work for hosts that supply them.
 *
 * Light DOM on purpose: Fluent 8 injects styles into document.head, which a
 * shadow root would not see. The trade-off vs the vendor's :host{all:initial}
 * isolation is that the surrounding Workflow page's CSS can reach our form;
 * revisit with Fluent's MergeStylesShadowRoot provider if that bites.
 * Registration guard included — Workflow hosts can load a bundle twice.
 */

initializeIcons();

class WebformsPlayerElement extends HTMLElement {
  private root: Root | null = null;

  connectedCallback(): void {
    if (!this.root) {
      this.textContent = "";   // clear the host page's fallback content
      const mount = document.createElement("div");
      this.appendChild(mount);
      this.root = createRoot(mount);
    }
    this.root.render(<App host={this} />);
  }

  disconnectedCallback(): void {
    this.root?.unmount();
    this.root = null;
  }
}

if (!customElements.get("webforms-player")) {
  customElements.define("webforms-player", WebformsPlayerElement);
}
