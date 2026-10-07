// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const source = fs.readFileSync(path.resolve(process.cwd(), "packages/form-components/src/nhforms/FormSessionRuntime/index.jsx"), "utf8");
const compiled = Babel.transform(source, { presets: ["react"] }).code ?? "";
const runtime = new Function("React", "produce", "useActiveData", `${compiled}; return { FormSessionProvider, useFormSessionData, applySessionUpdate };`)(
  React, produce, () => [{}, () => undefined],
);

it("preserves no-op session updates and keeps changed values isolated", () => {
  const previous = { field: { data: { note: "saved" } } };
  expect(runtime.applySessionUpdate(previous, () => undefined)).toBe(previous);
  const next = runtime.applySessionUpdate(previous, (draft: any) => { draft.field.data.note = "edited"; });
  expect(next.field.data.note).toBe("edited");
  expect(previous.field.data.note).toBe("saved");
});

it("normalizes initial data once, retains mount-time edits, and resets only when given a new seed", () => {
  const clone = vi.fn(() => ({ value: "original" }));
  let seed: any = { field: { data: { note: "saved", marker: { toJSON: clone } } } };
  let latest: any;
  let setSession: (updater: any) => void;
  const Reader = () => {
    [latest, setSession] = runtime.useFormSessionData();
    React.useEffect(() => {
      setSession((draft: any) => { draft.field.data.note = "mount edit"; });
    }, []);
    return null;
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = () => act(() => root.render(<runtime.FormSessionProvider initialFormData={seed}><Reader /></runtime.FormSessionProvider>));
  try {
    render();
    expect(clone).toHaveBeenCalledTimes(1);
    expect(latest.field.data.note).toBe("mount edit");
    expect(seed.field.data.note).toBe("saved");
    const snapshot = latest.field.data;
    act(() => setSession(() => undefined));
    expect(latest.field.data).toBe(snapshot);
    render();
    expect(latest.field.data.note).toBe("mount edit");
    seed = { field: { data: { note: "new seed" } } };
    render();
    expect(latest.field.data.note).toBe("new seed");
  } finally {
    act(() => root.unmount());
  }
});
