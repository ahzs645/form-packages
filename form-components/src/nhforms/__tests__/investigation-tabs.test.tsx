// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "InvestigationTabs", "index.jsx"), "utf8");

function loadInvestigationTabs(): {
  InvestigationTabs: React.ComponentType<any>;
  InvestigationTab: React.ComponentType<any>;
} {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // Same bare-global contract used by the injected NHForms runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function("React", `${compiled};\nreturn { InvestigationTabs, InvestigationTab };`);
  return factory(React);
}

const TABS = [
  { id: "tab-1", label: "Physiology" },
  { id: "tab-2", label: "Review" },
];

function renderTabs(props: Record<string, unknown> = {}) {
  const { InvestigationTabs, InvestigationTab } = loadInvestigationTabs();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() =>
    root.render(
      React.createElement(
        InvestigationTabs,
        { tabs: TABS, ...props },
        React.createElement(InvestigationTab, { tabId: "tab-1" }, React.createElement("div", null, "Physiology body")),
        React.createElement(InvestigationTab, { tabId: "tab-2" }, React.createElement("div", null, "Review body"))
      )
    )
  );
  return { container, root };
}

describe("InvestigationTabs", () => {
  it("mounts every tab panel so print includes the whole form", () => {
    const harness = renderTabs();

    // Both panels exist in the DOM; only the active one is visible on screen.
    expect(harness.container.textContent).toContain("Physiology body");
    expect(harness.container.textContent).toContain("Review body");
    const activePanel = harness.container.querySelector("#investigation-tab-panel-0") as HTMLElement;
    const inactivePanel = harness.container.querySelector("#investigation-tab-panel-1") as HTMLElement;
    expect(activePanel?.className).not.toContain("showonprint");
    expect(activePanel?.getAttribute("aria-hidden")).toBeNull();
    expect(inactivePanel?.className).toContain("showonprint");
    expect(inactivePanel?.getAttribute("aria-hidden")).toBe("true");
    // Every tab gets its own print-only label bar.
    const labelBars = Array.from(harness.container.querySelectorAll(".showonprint")).map((node) => node.textContent);
    expect(labelBars).toContain("Physiology");
    expect(labelBars).toContain("Review");
    act(() => harness.root.unmount());
  });

  it("switches panels on click and every tab button controls a real panel id", () => {
    const harness = renderTabs();

    const tabButtons = Array.from(harness.container.querySelectorAll('[role="tab"]'));
    tabButtons.forEach((button) => {
      const controls = button.getAttribute("aria-controls");
      expect(controls && harness.container.querySelector(`#${controls}`)).toBeTruthy();
    });

    act(() => {
      (tabButtons[1] as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const reviewPanel = harness.container.querySelector("#investigation-tab-panel-1") as HTMLElement;
    expect(reviewPanel?.className).not.toContain("showonprint");
    expect(harness.container.querySelector("#investigation-tab-panel-0")?.className).toContain("showonprint");
    act(() => harness.root.unmount());
  });

  it("supports arrow-key navigation with a roving tabindex", () => {
    const harness = renderTabs();

    const tablist = harness.container.querySelector('[role="tablist"]') as HTMLElement;
    const tabButtons = Array.from(harness.container.querySelectorAll('[role="tab"]')) as HTMLElement[];
    expect(tabButtons[0].tabIndex).toBe(0);
    expect(tabButtons[1].tabIndex).toBe(-1);

    act(() => {
      tablist.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(tabButtons[1].getAttribute("aria-selected")).toBe("true");
    expect(tabButtons[1].tabIndex).toBe(0);

    act(() => {
      tablist.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    // Wraps back to the first tab.
    expect(tabButtons[0].getAttribute("aria-selected")).toBe("true");
    act(() => harness.root.unmount());
  });
});
