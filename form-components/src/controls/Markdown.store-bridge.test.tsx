// @vitest-environment happy-dom
/**
 * Regression: the vendor test_panel_form's "Lab assessment note" (a Markdown
 * observation bound via section activeSelector to fd.panel[i].report) showed
 * its text in the Edit tab but a BLANK Preview tab. Cause: Markdown read
 * active data through MoisContext.useActiveData, which ignored the
 * form-state store the form actually writes (TextArea reads that store —
 * hence the tab disagreement). useActiveData now bridges to the innermost
 * FormStateProvider store.
 */
import React, { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { FormStateProvider, useActiveDataForForms } from "../index";
import { Markdown } from "./Markdown";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REPORT_TEXT = "In this test form, the sample data comes prefilled.";

function SeedPanel({ children }: { children: React.ReactNode }) {
  const [, setFormData] = useActiveDataForForms();
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    // The vendor form's useOnLoad shape: panel rows at the active-data ROOT.
    setFormData((draft: { panel?: Array<Record<string, unknown>> }) => {
      draft.panel = [{ report: REPORT_TEXT, value: "SEE REPORT" }];
    });
  }, [setFormData]);
  return <>{children}</>;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  document.body.innerHTML = "";
});

describe("Markdown reads the form-state store", () => {
  it("renders section-bound content in the Preview tab", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <FormStateProvider>
          <SeedPanel>
            <Markdown
              label="Lab assessment note"
              fieldId="report"
              section={{
                activeSelector: (fd: { panel?: Array<Record<string, unknown>> }) =>
                  fd.panel?.[0] ?? {},
              }}
            />
          </SeedPanel>
        </FormStateProvider>
      );
    });

    // Content resolved => the control starts on the Preview tab and renders
    // the markdown (previously: blank preview, content only in Edit).
    expect(container!.textContent).toContain("the sample data comes prefilled");
  });
});
