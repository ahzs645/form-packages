// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { MoisProvider, useCodeList } from "../MoisContext";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("preview MemoryCode lists", () => {
  it("feeds provider-supplied local data through useCodeList", () => {
    let observed: ReturnType<typeof useCodeList> = [];

    function Probe() {
      observed = useCodeList("MOIS-LABCODE");
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <MoisProvider
          sourceData={{
            memoryCodeLists: {
              "MOIS-LABCODE": [
                {
                  code: "1216",
                  display: "COCAINE / ur screen",
                  system: "MOIS-LABCODE",
                  labCode: "UCOCAINE",
                },
              ],
            },
          }}
        >
          <Probe />
        </MoisProvider>
      );
    });

    expect(observed).toEqual([
      {
        code: "1216",
        display: "COCAINE / ur screen",
        system: "MOIS-LABCODE",
        labCode: "UCOCAINE",
      },
    ]);

    act(() => root.unmount());
  });
});
