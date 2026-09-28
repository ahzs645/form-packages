// @vitest-environment happy-dom
/**
 * A scoring question's `enabledWhen`: DLQI's "If No…" follow-up (Q7b) can be
 * answered only when Q7 is "No", as MOIS window 120 draws it
 * (`num_field_0008` visible `If(num_field_0007 = 0, 1, 0)`, plain-text answers
 * otherwise). ScoringModule greys the question out and drops it from the
 * progress; the rule reaches the export and the component-insert config.
 */
import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import dlqi from "@/data/subform-library/dermatology_life_quality_index.json";
import { buildBuilderModuleConfigByDraftKey } from "@/components/workspaces/pilot-workspace/ai-json/modules";
import { renderSubformScoring } from "@/lib/mois-export/renderers/subform-scoring-renderer";
import { buildSubformScoringConfig } from "@/lib/subform-preset-config";
import type { GroupLayoutDraft } from "@webforms/form-model";
import { readNhformsSource, withTreeSupport } from "./formula-kit-trees";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type AnyRecord = Record<string, unknown>;
const Q7 = "q_dermatology_life_quality_index_q8";
const Q7B = "q_dermatology_life_quality_index_q1";
const RULE = { type: "equals", controllerId: Q7, value: "No" };

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const answer = (key: string) => ({ selectedKey: key, value: key, response: key });

function renderDlqi(data: AnyRecord) {
  const compiled = Babel.transform(
    ["ValueKit", "FormLogicKit", "ScoringModule"].map(readNhformsSource).join("\n"),
    { presets: ["react"], filename: "ScoringModule/index.jsx" },
  ).code ?? "";
  const Box = ({ children }: React.PropsWithChildren) => React.createElement("div", null, children);
  const state = { fd: { field: { data: { ...data }, status: {}, history: [] } } as { field: { data: AnyRecord } } };
  const useFormSessionData = (selector?: (fd: AnyRecord) => unknown) => {
    const [, force] = React.useState(0);
    const setFd = (updater: unknown) => {
      state.fd = typeof updater === "function"
        ? produce(state.fd, updater as (draft: AnyRecord) => void)
        : { ...state.fd, field: { ...state.fd.field, data: { ...state.fd.field.data, ...(updater as AnyRecord) } } };
      force((value) => value + 1);
    };
    return [selector ? selector(state.fd) : state.fd, setFd];
  };
  const scope: AnyRecord = {
    React,
    Fluent: new Proxy({}, { get: () => Box }),
    useFormSessionData,
    useTheme: () => ({}),
    useSourceData: () => ({}),
    FormulaKit: withTreeSupport(),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const ScoringModule = new Function(...Object.keys(scope), `${compiled}; return ScoringModule;`)(...Object.values(scope)) as React.ComponentType<AnyRecord>;
  const config = buildSubformScoringConfig(dlqi.module.scoring);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(React.createElement(ScoringModule, { config, showProgress: true })));
  const q7bRadios = () => Array.from(container!.querySelectorAll<HTMLInputElement>(`input[name="scoring_${Q7B}"]`));
  return { container, q7bRadios };
}

describe("DLQI Q7b is answerable only when Q7 is No", () => {
  it("keeps the rule on the library question, the export and the direct insert", () => {
    const q7b = dlqi.module.scoring.questions.find((question) => question.id === Q7B) as AnyRecord;
    expect(q7b.enabledWhen).toEqual(RULE);
    expect(buildSubformScoringConfig(dlqi.module.scoring).questions.find((question) => question.id === Q7B)?.enabledWhen).toEqual(RULE);

    const configs = buildBuilderModuleConfigByDraftKey([{ sectionId: "section_dlqi", subformLibraryId: "dermatology_life_quality_index" }], [], []);
    const [[key, moduleConfig]] = Array.from(configs.entries());
    const jsx = renderSubformScoring({ key, moduleConfig } as unknown as GroupLayoutDraft, "section_dlqi");
    expect(jsx.replace(/\s+/g, " ")).toContain(`enabledWhen: { type: "equals", controllerId: "${Q7}", value: "No" }`);
  });

  it("greys Q7b out until Q7 is No, and leaves it out of the progress meanwhile", () => {
    const blank = renderDlqi({});
    expect(blank.q7bRadios()).toHaveLength(3);
    expect(blank.q7bRadios().every((radio) => radio.disabled)).toBe(true);
    expect(blank.container.textContent).toContain("0 of 10 questions answered");
    act(() => root?.unmount());

    const no = renderDlqi({ [Q7]: answer("No") });
    expect(no.q7bRadios().some((radio) => radio.disabled)).toBe(false);
    expect(no.container.textContent).toContain("1 of 11 questions answered");
    act(() => root?.unmount());

    // a Q7b answer kept from an earlier "No" is not shown or counted after "Yes"
    const yes = renderDlqi({ [Q7]: answer("Yes"), [Q7B]: answer("A lot") });
    expect(yes.q7bRadios().every((radio) => radio.disabled && !radio.checked)).toBe(true);
    expect(yes.container.textContent).toContain("1 of 10 questions answered");
  });
});
