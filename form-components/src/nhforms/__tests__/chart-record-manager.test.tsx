// @vitest-environment happy-dom
/**
 * End-to-end CRUD loop for ChartRecordManager in the preview runtime:
 * real loader scope (ListSelection, SubformScoring modal, useMutation shim)
 * plus the preview chart store, so edits and deletes actually change the
 * chart the table re-reads — the vendor test-form loop, GUI-composed.
 */
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { FormStateProvider } from "@mois/form-components";
import { nhformsComponents } from "@mois/form-components/nhforms/next";
import { resetPreviewChartMutations } from "../../scope/preview-chart-store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ChartRecordManager = nhformsComponents.ChartRecordManager as React.ComponentType<any>;

// The mock patient's active connection (packages/form-components/src/data/selected-source.json).
const EXISTING_CONNECTION_NAME = "PRACTITIONER, GENERAL";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount(props: Record<string, unknown> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <FormStateProvider>
        <ChartRecordManager source="connections" {...props} />
      </FormStateProvider>
    );
  });
}

function buttonByText(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text
  );
  if (!match) throw new Error(`no button with text "${text}"`);
  return match as HTMLButtonElement;
}

function buttonsByAriaLabel(label: string): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll(`button[aria-label="${label}"]`));
}

async function settleMutation() {
  // The mock useMutation resolves on a 100ms timer.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
}

beforeEach(() => {
  resetPreviewChartMutations();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  document.body.innerHTML = "";
});

describe("ChartRecordManager", () => {
  it("renders the collection with row actions and a create button", async () => {
    await mount();
    expect(document.body.textContent).toContain(EXISTING_CONNECTION_NAME);
    expect(buttonsByAriaLabel("Edit").length).toBeGreaterThan(0);
    expect(buttonsByAriaLabel("Delete").length).toBeGreaterThan(0);
    expect(buttonByText("New patient connection")).toBeTruthy();
  });

  it("deletes a record through confirm + negated-id mutation and the row disappears", async () => {
    await mount();
    expect(document.body.textContent).toContain(EXISTING_CONNECTION_NAME);

    await act(async () => {
      buttonsByAriaLabel("Delete")[0].click();
    });
    expect(document.body.textContent).toContain("Confirm delete");

    await act(async () => {
      buttonByText("Confirm").click();
    });
    await settleMutation();

    expect(document.body.textContent).not.toContain(EXISTING_CONNECTION_NAME);
  });

  it("keeps prescriptions create/update only (no verified delete)", async () => {
    await mount({ source: "prescriptions" });
    expect(buttonsByAriaLabel("Delete")).toHaveLength(0);
    expect(buttonsByAriaLabel("Edit").length).toBeGreaterThan(0);
  });

  it("edits a record: modal opens seeded, Save fires the update mutation", async () => {
    await mount({
      dataEntryFields: [{ id: "comment", label: "Comment", type: "text" }],
    });

    await act(async () => {
      buttonsByAriaLabel("Edit")[0].click();
    });
    // The data-entry modal is open with the configured field.
    expect(document.body.textContent).toContain("Comment");

    const commentInput = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
    ).find((element) => element.closest("[role='dialog'], .ms-Dialog, [data-component='SubForm']"))
      ?? document.querySelector<HTMLInputElement>("input");
    expect(commentInput).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        commentInput!.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(commentInput, "updated from manager");
      commentInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      buttonByText("Save").click();
    });
    await settleMutation();

    // The mutation upserted by connectionId (Edit seeds the full record as
    // payload defaults), so the row is still present, not duplicated.
    expect(document.body.textContent).toContain(EXISTING_CONNECTION_NAME);
    expect(buttonsByAriaLabel("Edit").length).toBe(1);
  });

  it("creates a record from a template button", async () => {
    await mount({
      dataEntryFields: [{ id: "comment", label: "Comment", type: "text" }],
      templates: [
        {
          label: "New POA",
          defaults: {
            connectionType: { code: "POA", display: "Power of Attorney", system: "MOIS-CONNECTIONTYPE" },
            includeOnDemographics: { code: "Y", display: "Yes", system: "MOIS-YESNO" },
          },
        },
      ],
    });

    await act(async () => {
      buttonByText("New POA").click();
    });
    await act(async () => {
      buttonByText("Save").click();
    });
    await settleMutation();

    // A second row appeared (created id assigned by the preview store).
    expect(buttonsByAriaLabel("Edit").length).toBe(2);
    expect(document.body.textContent).toContain("Power of Attorney");
  });
});
