// @vitest-environment happy-dom
/**
 * ChartRecordManager re-reads the chart (refresh(sd), the vendor CRUD forms'
 * contract) after every successful create/edit. Its editor hands that to
 * SubformScoring as onCommitToParent; the SubformScoring wrapper used to
 * replace the host's callback with its own parent merge, so the refresh never
 * ran. Runs through the real generated loader scope.
 */
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { FormStateProvider } from "@mois/form-components";
import { nhformsComponents } from "@mois/form-components/nhforms/next";
import { resetPreviewChartMutations } from "../../scope/preview-chart-store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ChartRecordManager = nhformsComponents.ChartRecordManager as React.ComponentType<Record<string, unknown>>;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function buttonByText(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text,
  );
  if (!match) throw new Error(`no button with text "${text}"`);
  return match as HTMLButtonElement;
}

beforeEach(() => {
  resetPreviewChartMutations();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  document.body.innerHTML = "";
});

describe("ChartRecordManager chart refresh", () => {
  it("refreshes the chart after a successful create", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <FormStateProvider>
          <ChartRecordManager
            source="connections"
            newButtonText="New record"
            dataEntryFields={[{ id: "comment", label: "Comment", type: "text" }]}
          />
        </FormStateProvider>,
      );
    });

    const refreshCalls = () => log.mock.calls.filter(([message]) => message === "refresh called").length;
    expect(refreshCalls()).toBe(0);

    await act(async () => {
      buttonByText("New record").click();
    });
    await act(async () => {
      buttonByText("Save").click();
    });
    // The preview useMutation resolves on a 100ms timer.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(refreshCalls()).toBe(1);
  });
});
