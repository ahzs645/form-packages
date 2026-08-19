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
const ChartRecordList = nhformsComponents.ChartRecordList as React.ComponentType<any>;
const ChartRecordCreateButton = nhformsComponents.ChartRecordCreateButton as React.ComponentType<any>;
const ChartRecordEditor = nhformsComponents.ChartRecordEditor as React.ComponentType<any>;

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

describe("decomposed pieces (list hosting its editor + standalone buttons)", () => {
  it("coordinates separate fields through the managerId channel", async () => {
    // The decomposed authoring model: the list HOSTS the editor (invisible
    // chrome, not a placeable field); buttons wire to it by sharing the
    // managerId, which defaults to the source.
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <FormStateProvider>
          <ChartRecordList
            source="connections"
            dataEntryFields={[{ id: "comment", label: "Comment", type: "text" }]}
          />
          <ChartRecordCreateButton
            source="connections"
            text="New POA"
            defaults={{
              connectionType: { code: "POA", display: "Power of Attorney", system: "MOIS-CONNECTIONTYPE" },
            }}
          />
        </FormStateProvider>
      );
    });

    expect(document.body.textContent).toContain(EXISTING_CONNECTION_NAME);

    // Row delete on the LIST opens the EDITOR's confirm dialog.
    await act(async () => {
      buttonsByAriaLabel("Delete")[0].click();
    });
    expect(document.body.textContent).toContain("Confirm delete");
    await act(async () => {
      buttonByText("Confirm").click();
    });
    await settleMutation();
    expect(document.body.textContent).not.toContain(EXISTING_CONNECTION_NAME);

    // The standalone BUTTON opens the EDITOR's modal; Save creates the record.
    await act(async () => {
      buttonByText("New POA").click();
    });
    await act(async () => {
      buttonByText("Save").click();
    });
    await settleMutation();
    expect(document.body.textContent).toContain("Power of Attorney");
  });
});

describe("create button width", () => {
  it("renders natural width by default and spans only with fullWidth", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <FormStateProvider>
          <div data-testid="compact">
            <ChartRecordCreateButton source="preferences" text="Compact" />
          </div>
          <div data-testid="wide">
            <ChartRecordCreateButton source="preferences" text="Wide" fullWidth />
          </div>
        </FormStateProvider>
      );
    });

    const compactWrapper = container!
      .querySelector("[data-testid='compact']")!
      .firstElementChild as HTMLElement;
    expect(compactWrapper.style.display).toBe("inline-flex");

    const wideWrapper = container!
      .querySelector("[data-testid='wide']")!
      .firstElementChild as HTMLElement;
    expect(wideWrapper.style.display).toBe("flex");
    expect(wideWrapper.style.width).toBe("100%");
  });
});

describe("standalone create button (no list on the form)", () => {
  it("hosts its own default editor and creates the record", async () => {
    const { overlayPreviewChartMutations } = await import("../../scope/preview-chart-store");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    // Buttons-only form: no ChartRecordList anywhere.
    await act(async () => {
      root!.render(
        <FormStateProvider>
          <ChartRecordCreateButton
            source="connections"
            text="New POA"
            defaults={{
              connectionType: { code: "POA", display: "Power of Attorney", system: "MOIS-CONNECTIONTYPE" },
            }}
          />
        </FormStateProvider>
      );
    });

    await act(async () => {
      buttonByText("New POA").click();
    });
    // The button's own fallback editor opened with the source's default
    // coded fields.
    expect(document.body.textContent).toContain("Role");
    expect(document.body.textContent).toContain("Provider type");

    await act(async () => {
      buttonByText("Save").click();
    });
    await settleMutation();

    const patient = overlayPreviewChartMutations({ connections: [] as Array<Record<string, unknown>> });
    expect(patient.connections).toHaveLength(1);
    expect((patient.connections[0] as { connectionType?: { code?: string } }).connectionType?.code).toBe("POA");
  });
});

describe("template modal (vendor-style)", () => {
  it("hides template-fixed fields and uses the vendor create title", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <FormStateProvider>
          <ChartRecordCreateButton
            source="preferences"
            text="Create MOST Preference"
            createTitle="Create MOST Preference"
            hiddenFieldIds={["classification", "preferenceType", "preference"]}
            defaults={{
              classification: { code: "ADVANCE DIRECTIVE", display: "Advance directive", system: "MOIS-PREFERENCECLASSIFICATION" },
              preference: "MOST",
            }}
          />
          <ChartRecordEditor source="preferences" />
        </FormStateProvider>
      );
    });

    await act(async () => {
      buttonByText("Create MOST Preference").click();
    });

    const text = document.body.textContent ?? "";
    // Vendor dialog title, not the generic "Edit ...".
    expect(text).toContain("Create MOST Preference");
    // Template-fixed fields are hidden (the vendor's per-button placement)…
    expect(text).not.toContain("Classification");
    expect(text).not.toContain("Subject type");
    // …while the fields the clinician actually fills remain.
    for (const label of ["Subject detail", "Instruction", "Reason", "Start date", "Sensitive"]) {
      expect(text).toContain(label);
    }
  });
});

describe("edit modal (vendor-style)", () => {
  it("hides identity fields on preference edit and pairs half-width fields", async () => {
    // Seed a preference row so there is something to edit.
    const { applyPreviewChartMutation } = await import("../../scope/preview-chart-store");
    applyPreviewChartMutation(
      "mutation p { changeChartPreference(patientId: $p, chartPreference: $c) { patientId } }",
      {
        patientId: 500063,
        chartPreference: {
          chartPreferenceId: 0,
          preference: "PHARMANET ACCESS",
          classification: { code: "DISCLOSURE", display: "Disclosure", system: "MOIS-PREFERENCECLASSIFICATION" },
          startDate: "2014-09-09",
        },
      }
    );

    await mount({ source: "preferences", modalTitle: "Preference / consent" });
    await act(async () => {
      buttonsByAriaLabel("Edit")[0].click();
    });

    // Scope to the dialog: the table behind it legitimately has a
    // "Classification" column header.
    const dialog = Array.from(document.querySelectorAll<HTMLElement>(".ms-Dialog, [role='dialog']"))
      .find((el) => el.textContent?.includes("Preference / consent"));
    expect(dialog).toBeTruthy();
    const text = dialog!.textContent ?? "";
    // The vendor's PreferenceEdit placement: identity is not editable —
    // classification/subject-type/preference stay out of the edit dialog.
    expect(text).not.toContain("Classification");
    expect(text).not.toContain("Subject type");
    for (const label of ["Subject detail", "Instruction detail", "Reason detail", "Start date", "End date"]) {
      expect(text).toContain(label);
    }

    // Half-width pairs actually share a row: the container basis subtracts
    // the flex gap (a bare 50% + 50% + 12px gap always wrapped to stacked).
    const startDateCell = Array.from(document.querySelectorAll<HTMLElement>("div"))
      .find((el) => el.style.maxWidth === "calc(50% - 12px)");
    expect(startDateCell).toBeTruthy();
  });
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

  it("derives coded modal fields for connections (vendor-informed defaults)", async () => {
    await mount();
    await act(async () => {
      buttonsByAriaLabel("Edit")[0].click();
    });
    // The default connections field set renders coded editors, not free text:
    // FindCodeSelect inputs carry placeholder "Please search".
    const text = document.body.textContent ?? "";
    for (const label of ["Role", "Provider type", "Stopped reason", "Care team member"]) {
      expect(text).toContain(label);
    }
    expect(
      document.querySelectorAll("input[placeholder='Please search']").length
    ).toBeGreaterThanOrEqual(3);
  });

  it("cascades connection type to its default provider type and clears provider", async () => {
    const { nhformsComponentGroups } = await import("@mois/form-components/nhforms/next");
    void nhformsComponentGroups; // loader warm
    const managerSource = (await import("node:fs")).readFileSync(
      (await import("node:path")).join(
        process.cwd(),
        "packages/form-components/src/nhforms/ChartRecordManager/index.jsx"
      ),
      "utf8"
    );
    // Unit-test the cascade helper directly (it is pure): compile the helper
    // region and run it against the real option lists.
    const Babel = await import("@babel/standalone");
    const compiled = Babel.transform(managerSource, { presets: ["react"], filename: "index.jsx" }).code ?? "";
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const factory = new Function(
      "React",
      "window",
      "Fluent",
      "_chartRecordTablePresets",
      `${compiled}; return { _chartRecordManagerApplyCascades, _chartRecordManagerDefaultCascades, _chartRecordManagerFieldTransforms };`
    );
    const helpers = factory(React, {}, {}, {});
    const optionLists = (await import("../../data/optionLists.json")).default as Record<
      string,
      Record<string, string>
    >;
    const sd = { optionLists };

    const cascaded = helpers._chartRecordManagerApplyCascades(
      helpers._chartRecordManagerDefaultCascades.connections,
      "connectionType",
      { code: "PRIMARY", display: "Primary Care Provider", system: "MOIS-CONNECTIONTYPE" },
      { connectionType: { code: "PRIMARY" }, provider: { code: "X" } },
      sd
    );
    expect(cascaded.providerType).toEqual({
      code: "100",
      display: "PROVIDER (EXT)",
      system: "MOIS-CONNECTIONPROVIDERTYPE",
    });

    const cleared = helpers._chartRecordManagerApplyCascades(
      helpers._chartRecordManagerDefaultCascades.connections,
      "providerType",
      { code: "110" },
      { providerType: { code: "110" }, provider: { code: "X" } },
      sd
    );
    expect(cleared.provider).toBeUndefined();

    // Layered instruction lookup: classification-specific list, with the
    // classification-only fallback when no subject-specific list exists.
    const fields = [{ id: "instruction", label: "Instruction", type: "choice", codeSystem: "MOIS-PREFINST" }];
    const layered = helpers._chartRecordManagerFieldTransforms.preferences(
      fields,
      { classification: { code: "CONSENT" }, codedSubject: { code: "04000" } },
      sd
    );
    expect(layered[0].codeSystem).toBe("MOIS-PREFINST:CONSENT:04000");
    const fallback = helpers._chartRecordManagerFieldTransforms.preferences(
      fields,
      { classification: { code: "CONSENT" }, codedSubject: { code: "NO-SUCH-SUBJECT" } },
      sd
    );
    expect(fallback[0].codeSystem).toBe("MOIS-PREFINST:CONSENT");
  });

  it("seeds the modal draft with template defaults so prefills are visible", async () => {
    await mount({
      source: "preferences",
      dataEntryFields: [
        { id: "preference", label: "Preference", type: "text" },
        { id: "subjectDetail", label: "Subject detail", type: "textarea" },
      ],
      templates: [
        {
          label: "New MOST",
          defaults: {
            classification: { code: "ADVANCE DIRECTIVE", display: "Advance directive", system: "MOIS-PREFERENCECLASSIFICATION" },
            preference: "MOST",
          },
        },
      ],
    });

    await act(async () => {
      buttonByText("New MOST").click();
    });
    // The mapped default ("preference" -> "MOST") is visible in the modal
    // field, not just riding invisibly in the payload.
    const preferenceInput = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
    ).find((element) => element.value === "MOST");
    expect(preferenceInput).toBeTruthy();

    await act(async () => {
      buttonByText("Save").click();
    });
    await settleMutation();
    expect(document.body.textContent).toContain("MOST");
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
