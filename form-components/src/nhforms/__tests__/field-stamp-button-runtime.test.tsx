// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// West of UTC, so a stamp taken in the evening would read tomorrow in UTC.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Vancouver";
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

type Data = Record<string, any>;
const h = React.createElement;
const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ActiveDataContext = React.createContext<[Data, (updater: unknown) => void]>([{}, () => undefined]);

function loadFieldStampButton(userProfile: Data) {
  const source = fs.readFileSync(path.join(NH, "FieldStampButton", "index.jsx"), "utf8");
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const Button = (props: { text: string; onClick?: () => void; disabled?: boolean }) =>
    h("button", { type: "button", onClick: props.onClick, disabled: props.disabled }, props.text);
  const scope = {
    React,
    Fluent: {
      DefaultButton: Button,
      PrimaryButton: Button,
      Stack: (props: { children?: React.ReactNode }) => h("div", null, props.children),
      Text: (props: { children?: React.ReactNode }) => h("span", null, props.children),
    },
    useSourceData: () => ({ userProfile }),
    useActiveData: () => React.useContext(ActiveDataContext),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compiled};\nreturn FieldStampButton;`)(
    ...Object.values(scope),
  ) as React.ComponentType<Record<string, unknown>>;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

function pressStamp(targets: unknown[], userProfile: Data = { identity: { initials: "DPU", fullName: "Dr. Preview User" } }) {
  const FieldStampButton = loadFieldStampButton(userProfile);
  let latest: Data = {};
  const Host = () => {
    const [data, setData] = React.useState<Data>({ field: { data: {} }, formData: {} });
    latest = data;
    const update = (updater: unknown) =>
      setData((current) => (typeof updater === "function" ? produce(current, updater as (draft: Data) => void) : (updater as Data)));
    return h(ActiveDataContext.Provider, { value: [data, update] }, h(FieldStampButton, { id: "task_1_stamp", label: "Complete", targets }));
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(h(Host)));
  act(() => container!.querySelector("button")!.click());
  return latest.field.data as Data;
}

describe("FieldStampButton value templates", () => {
  it("stamps the local date and the signed-in user's initials into one answer", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T03:30:00Z")); // 20:30 on 28 Sep in Vancouver

    const data = pressStamp([{ fieldId: "answer_16", value: "{today:dd/MMM/yyyy} {userInitials}" }]);

    expect(data.answer_16).toBe("28/Sep/2026 DPU");
    expect(data.task_1_stamp).toMatchObject({ signed: true, written: { answer_16: "28/Sep/2026 DPU" } });
  });

  it("stamps $today as the local day, not the UTC one", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T03:30:00Z"));

    expect(pressStamp([{ fieldId: "date", value: "$today" }]).date).toBe("2026-09-28");
  });

  it("leaves no stray space when the user has no initials on file", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T18:00:00Z"));

    const data = pressStamp([{ fieldId: "answer_16", value: "{today:yyyy-MM-dd} {userInitials}" }], { identity: {} });

    expect(data.answer_16).toBe("2026-09-28");
  });
});
