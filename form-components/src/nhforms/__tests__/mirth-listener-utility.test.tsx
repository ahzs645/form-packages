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
const source = fs.readFileSync(path.join(NH, "MirthListenerUtility", "index.jsx"), "utf8");

const FluentStub = {
  Stack: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
  Label: ({ children }: { children?: React.ReactNode }) => React.createElement("label", null, children),
  TextField: ({ value, onChange, ariaLabel }: { value?: string; onChange?: (event: unknown, value?: string) => void; ariaLabel?: string }) =>
    React.createElement("input", {
      value: value ?? "",
      "aria-label": ariaLabel,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event, event.target.value),
    }),
  DefaultButton: ({ text, onClick, disabled }: { text?: string; onClick?: () => void; disabled?: boolean }) =>
    React.createElement("button", { type: "button", onClick, disabled }, text),
  PrimaryButton: ({ text, onClick, disabled }: { text?: string; onClick?: () => void; disabled?: boolean }) =>
    React.createElement("button", { type: "button", "data-primary": true, onClick, disabled }, text),
};

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => {}]);

function loadUtility(): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "produce",
    `${compiled};\nreturn { MirthListenerUtility };`
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  const useSourceData = () => ({
    formParams: { formPath: "developer-mirth-test" },
    formObject: { Identity: { name: "Developer Mirth Test" } },
    userProfile: { identity: { fullName: "Test Clinician" }, loginName: "tclinician" },
  });
  return factory(React, FluentStub, useActiveData, useSourceData, produce).MirthListenerUtility;
}

function renderUtility(props: Record<string, unknown> = {}) {
  const Utility = loadUtility();
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
      React.createElement(Utility, {
        id: "dev-mirth-utility",
        responseFieldId: "dev_mirth_utility_last_result",
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

function setControlValue(element: HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else (element as any).value = value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === text);
  if (!button) throw new Error(`Button "${text}" not found`);
  return button as HTMLButtonElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("MirthListenerUtility", () => {
  it("signs and sends the previewed payload to the default site and persists the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      statusText: "Accepted",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ accepted: true, messageId: "utility-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const harness = renderUtility();

    await act(async () => {
      findButton(harness.container, "Sign & Send").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("http://mirthc1.northernhealth.ca:7900/webforms/");
    const request = fetchMock.mock.calls[0][1];
    expect(request.headers).toMatchObject({ "Content-Type": "application/json" });
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      event: "webform-connectivity-test",
      source: "webforms-mirth-listener-utility",
      test: true,
      signed: { by: "Test Clinician" },
    });
    expect(body.sentAt).not.toBe("(stamped at send time)");
    expect(body).not.toHaveProperty("patient");
    expect(harness.container.textContent).toContain("Success (202)");
    expect(harness.container.textContent).toContain('"messageId": "utility-123"');
    expect(harness.getState().field.data.dev_mirth_utility_last_result).toMatchObject({
      endpointUrl: "http://mirthc1.northernhealth.ca:7900/webforms/",
      sendMethod: "fetch",
      ok: true,
      status: 202,
    });
    act(() => harness.root.unmount());
  });

  it("targets the selected site and sends the schemaVersion 2 notification template", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "application/json" },
      text: async () => "{}",
    });
    vi.stubGlobal("fetch", fetchMock);
    const harness = renderUtility();

    const siteSelect = harness.container.querySelector('select[aria-label="Mirth listener site"]') as HTMLSelectElement;
    const payloadSelect = harness.container.querySelector('select[aria-label="Payload template"]') as HTMLSelectElement;
    act(() => setControlValue(siteSelect, "test-ip"));
    act(() => setControlValue(payloadSelect, "notification"));

    await act(async () => {
      findButton(harness.container, "Sign & Send").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls[0][0]).toBe("http://10.171.20.220:7900/webforms/");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ schemaVersion: 2, webformId: 12345, chartId: 700001 });
    act(() => harness.root.unmount());
  });

  it("supports a custom URL and the no-cors send method", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 0, type: "opaque" });
    vi.stubGlobal("fetch", fetchMock);
    const harness = renderUtility();

    const siteSelect = harness.container.querySelector('select[aria-label="Mirth listener site"]') as HTMLSelectElement;
    act(() => setControlValue(siteSelect, "custom"));
    const customInput = harness.container.querySelector('input[aria-label="Custom listener URL"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(customInput, "http://10.171.20.220:7900/webforms");
      customInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const methodSelect = harness.container.querySelector('select[aria-label="Send method"]') as HTMLSelectElement;
    act(() => setControlValue(methodSelect, "fetch-no-cors"));

    await act(async () => {
      findButton(harness.container, "Sign & Send").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    // /webforms is normalized to /webforms/ and the request goes out no-cors as text/plain.
    expect(fetchMock.mock.calls[0][0]).toBe("http://10.171.20.220:7900/webforms/");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
    });
    expect(harness.container.textContent).toContain("opaque");
    expect(harness.getState().field.data.dev_mirth_utility_last_result).toMatchObject({
      sendMethod: "fetch-no-cors",
      ok: true,
    });
    act(() => harness.root.unmount());
  });

  it("sends via navigator.sendBeacon without expecting a response", async () => {
    const beaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: beaconMock });
    const harness = renderUtility();

    const methodSelect = harness.container.querySelector('select[aria-label="Send method"]') as HTMLSelectElement;
    act(() => setControlValue(methodSelect, "beacon"));

    await act(async () => {
      findButton(harness.container, "Sign & Send").click();
      await Promise.resolve();
    });

    expect(beaconMock).toHaveBeenCalledOnce();
    expect(beaconMock.mock.calls[0][0]).toBe("http://mirthc1.northernhealth.ca:7900/webforms/");
    expect(harness.container.textContent).toContain("Mirth dashboard");
    expect(harness.getState().field.data.dev_mirth_utility_last_result).toMatchObject({
      sendMethod: "beacon",
      ok: true,
    });
    act(() => harness.root.unmount());
  });

  it("blocks sending while the payload preview is not valid JSON", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const harness = renderUtility();

    const textarea = harness.container.querySelector('textarea[aria-label="JSON payload preview"]') as HTMLTextAreaElement;
    act(() => setControlValue(textarea, "{ not json"));

    expect(harness.container.textContent).toContain("Payload is not valid JSON");
    const sendButton = findButton(harness.container, "Sign & Send");
    expect(sendButton.disabled).toBe(true);
    act(() => sendButton.click());
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => harness.root.unmount());
  });
});
