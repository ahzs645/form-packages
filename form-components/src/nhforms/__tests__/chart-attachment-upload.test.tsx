// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "ChartAttachmentUpload", "index.jsx"), "utf8");

const FluentStub = {
  Stack: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
  MessageBar: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  MessageBarType: { warning: 4, error: 1 },
  TextField: ({ label, value, onChange, disabled }: any) => React.createElement(
    "label",
    null,
    label,
    React.createElement("input", {
      value,
      disabled,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event, event.target.value),
    }),
  ),
  PrimaryButton: ({ text, onClick, disabled }: any) =>
    React.createElement("button", { type: "button", onClick, disabled }, text),
  DefaultButton: ({ text, onClick, disabled }: any) =>
    React.createElement("button", { type: "button", onClick, disabled }, text),
};

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => {}]);

function loadComponent(): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "produce",
    `${compiled};\nreturn { ChartAttachmentUpload };`,
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  const useSourceData = () => ({
    auth: { apiServer: "https://mois-test.example/", jwToken: "secret-test-token" },
    userProfile: { userProfileId: 1234 },
    formParams: { patientId: 5678 },
  });
  return factory(React, FluentStub, useActiveData, useSourceData, produce).ChartAttachmentUpload;
}

function renderComponent(props: Record<string, unknown> = {}) {
  const Component = loadComponent();
  let currentState: any = null;

  const Harness = () => {
    const [state, setState] = React.useState({ field: { data: {}, status: {}, history: [] } });
    currentState = state;
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [state, setState] },
      React.createElement(Component, {
        id: "attachment-test",
        resultFieldId: "attachment_result",
        ...props,
      }),
    );
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return { container, root, getState: () => currentState };
}

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ChartAttachmentUpload", () => {
  it("sends the MOIS multipart attachment contract and persists only metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ documentId: 9012, pathname: "attachment-probe.txt" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const harness = renderComponent();
    const file = new File(["attachment capability probe"], "attachment-probe.txt", { type: "text/plain" });

    await act(async () => {
      selectFile(harness.container, file);
    });
    const uploadButton = Array.from(harness.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Upload test attachment")!;
    expect(uploadButton.disabled).toBe(false);

    await act(async () => {
      uploadButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://mois-test.example/api/attachment/file/1234/5678/");
    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({ Authorization: "Bearer secret-test-token" });
    expect(request.headers).not.toHaveProperty("Content-Type");
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("file")).toBe(file);
    expect(JSON.parse(String((request.body as FormData).get("document")))).toEqual({
      documentId: 0,
      patientId: 5678,
      note: "Uploaded from Webforms attachment API test",
      documentType: {
        code: "NOTE",
        display: "Note / General Purpose Document",
        system: "MOIS-DOCUMENTTYPE",
      },
    });
    expect(harness.container.textContent).toContain("Upload succeeded (200)");
    expect(harness.getState().field.data.attachment_result).toMatchObject({
      ok: true,
      status: 200,
      endpoint: "https://mois-test.example/api/attachment/file/1234/5678/",
      patientId: 5678,
      userProfileId: 1234,
      file: { name: "attachment-probe.txt", type: "text/plain" },
      body: { documentId: 9012, pathname: "attachment-probe.txt" },
    });
    expect(JSON.stringify(harness.getState())).not.toContain("secret-test-token");
    expect(JSON.stringify(harness.getState())).not.toContain("attachment capability probe");
    act(() => harness.root.unmount());
  });

  it("shows and persists an HTTP failure response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ error: "Attachment upload is not permitted" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const harness = renderComponent();

    await act(async () => {
      selectFile(harness.container, new File(["probe"], "probe.txt", { type: "text/plain" }));
    });
    const uploadButton = Array.from(harness.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Upload test attachment")!;
    await act(async () => {
      uploadButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(harness.container.textContent).toContain("Upload failed (403)");
    expect(harness.container.textContent).toContain("HTTP 403: Forbidden");
    expect(harness.getState().field.data.attachment_result).toMatchObject({
      ok: false,
      status: 403,
      error: "HTTP 403: Forbidden",
      body: { error: "Attachment upload is not permitted" },
    });
    act(() => harness.root.unmount());
  });
});
