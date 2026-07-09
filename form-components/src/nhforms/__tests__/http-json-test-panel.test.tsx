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
const source = fs.readFileSync(path.join(NH, "HttpJsonTestPanel", "index.jsx"), "utf8");

const FluentStub = {
  Stack: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
  DefaultButton: ({ text, onClick, disabled }: { text?: string; onClick?: () => void; disabled?: boolean }) =>
    React.createElement("button", { type: "button", onClick, disabled }, text),
};

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => {}]);

function loadPanel(): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "produce",
    `${compiled};\nreturn { HttpJsonTestPanel };`
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  const useSourceData = () => ({
    formParams: { formPath: "developer-mirth-test" },
    formObject: { Identity: { name: "Developer Mirth Test" } },
  });
  return factory(React, FluentStub, useActiveData, useSourceData, produce).HttpJsonTestPanel;
}

function renderPanel(props: Record<string, unknown> = {}) {
  const Panel = loadPanel();
  let currentState: any = null;

  const Harness = () => {
    const [state, setState] = React.useState({ field: { data: {}, status: {}, history: [] } });
    currentState = state;
    const setter = (updater: any) => setState((previous: any) =>
      typeof updater === "function" ? updater(previous) : updater
    );
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [state, setter] },
      React.createElement(Panel, {
        endpointUrl: "http://10.171.20.220:7900/webforms",
        outputId: "dev-mirth-http-json",
        responseFieldId: "dev_mirth_last_result",
        ...props,
      })
    );
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return { container, root, getState: () => currentState };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("HttpJsonTestPanel", () => {
  it("sends a synthetic request and persists the readable response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      statusText: "Accepted",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ accepted: true, messageId: "test-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const harness = renderPanel();

    await act(async () => {
      harness.container.querySelector("button")!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0][1];
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      event: "webform-connectivity-test",
      source: "webforms-http-test-panel",
      test: true,
      outputId: "dev-mirth-http-json",
    });
    expect(body).not.toHaveProperty("patient");
    expect(body).not.toHaveProperty("formData");
    expect(harness.container.textContent).toContain("Success (202)");
    expect(harness.container.textContent).toContain('"messageId": "test-123"');
    expect(harness.getState().field.data.dev_mirth_last_result).toMatchObject({
      ok: true,
      status: 202,
      body: { accepted: true, messageId: "test-123" },
    });
    act(() => harness.root.unmount());
  });

  it("displays and persists a submit/sign workflow error event", () => {
    const harness = renderPanel({ showManualTest: false });
    const result = {
      source: "workflow-submit",
      outputId: "dev-mirth-http-json",
      ok: false,
      status: null,
      error: "Failed to fetch",
      diagnostic: "Check network access and Mirth CORS OPTIONS handling.",
      receivedAt: "2026-07-09T18:00:00.000Z",
    };

    act(() => {
      window.dispatchEvent(new CustomEvent("builder:http-json-result", { detail: result }));
    });

    expect(harness.container.textContent).toContain("Connection failed");
    expect(harness.container.textContent).toContain("Failed to fetch");
    expect(harness.getState().field.data.dev_mirth_last_result).toMatchObject(result);
    act(() => harness.root.unmount());
  });
});
