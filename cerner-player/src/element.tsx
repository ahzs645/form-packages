import { initializeIcons } from "@fluentui/react/lib/Icons";
import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { App } from "./App";

/**
 * Workflow-component packaging: one custom element the host page drops in.
 *
 *   <webforms-player person_id="..." encntr_id="..." prsnl_id="..."
 *                    form-id="demo" theme="cerner"
 *                    content-root="https://host/custom_mpage_content/webforms-player">
 *
 * Light DOM on purpose (the production PHAS MPage does the same): Fluent 8
 * injects styles into document.head, which a shadow root would not see.
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
