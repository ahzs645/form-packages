// @vitest-environment happy-dom
//
// Terra components read `window.navigator` at render time (an IE check in
// terra-form-field), so even static rendering of the fork needs a DOM.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allFieldKindsFixture } from "./__tests__/fixtures";
import { getTerraCompatibilityReport } from "./compatibility";
import { TerraFormRenderer } from "./TerraFormRenderer";

/**
 * Coverage bar for this render target, mirroring the AlayaCare one: every
 * control the fixture needs must actually appear in the rendered output. A
 * control that resolves in the mapping but never renders fails the build.
 */

const markup = renderToStaticMarkup(<TerraFormRenderer fields={allFieldKindsFixture} />);
const report = getTerraCompatibilityReport(allFieldKindsFixture);

describe("TerraFormRenderer coverage", () => {
  it("renders every control the fixture resolves to", () => {
    expect(report.controls.length).toBeGreaterThan(0);
    for (const control of report.controls) {
      expect(markup).toContain(`data-terra-control="${control}"`);
    }
  });

  it("renders a stamped element for every field, supported or not", () => {
    for (const field of allFieldKindsFixture) {
      expect(markup).toContain(`data-field-id="${field.id}"`);
    }
  });

  it("covers the choice styles through their distinct controls", () => {
    for (const control of ["radio-group", "checkbox-group", "select", "select-search"]) {
      expect(markup).toContain(`data-terra-control="${control}"`);
    }
  });

  it("renders section and heading structure", () => {
    expect(markup).toContain('data-terra-control="section"');
    expect(markup).toContain('data-terra-control="heading"');
    expect(markup).toContain("data-terra-section");
  });

  it("keeps a MOIS component field visible as a named placeholder", () => {
    const component = allFieldKindsFixture.find((field) => field.type === "component");
    expect(component).toBeDefined();
    expect(markup).toContain('data-terra-control="component-placeholder"');
    expect(markup).toContain(String(component?.componentKey));
  });

  it("renders real Terra markup, not bare inputs", () => {
    // Terra ships CSS modules, so its classes arrive hashed (e.g.
    // `_hyperlink_ca3db5`) rather than as readable `terra-*` names.
    expect(markup).toMatch(/class="_[a-z-]+_[a-f0-9]{6}/i);
  });

  it("labels every rendered field", () => {
    // React escapes text content, so compare against the escaped form.
    const escape = (text: string) =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    // Structural and display-only kinds render their content rather than a
    // separate label: a rich-text block shows its markdown, a hyperlink shows
    // its configured link text, headings render as headings.
    const displayOnly = new Set(["section", "heading", "richText", "hyperlink"]);
    for (const field of allFieldKindsFixture) {
      if (displayOnly.has(field.type) || !field.label) continue;
      expect(markup).toContain(escape(field.label));
    }
  });
});
