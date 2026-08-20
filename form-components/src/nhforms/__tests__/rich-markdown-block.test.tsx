// @vitest-environment happy-dom
/**
 * RichMarkdownBlock is loaded twice here, through the same
 * `Function(React, …)` contract the engine uses, with two different scopes:
 *
 *  1. Preview scope — ReactMarkdown / remarkGfm / rehypeRaw injected, as
 *     packages/form-components/src/nhforms/index.next.ts does locally.
 *  2. Engine scope — none of them, because the MOIS form engine passes only
 *     React, Fabric, Fluent, MoisControl, MoisFunction, MoisActions, MoisHooks
 *     and Mois (see data/mois-engine-manifest.json). A component that reaches
 *     for ReactMarkdown there renders nothing but raw markdown text, which is
 *     what the old MoisMarkdownBlock/RichMarkdownBlock pair did in production.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "RichMarkdownBlock", "index.jsx"), "utf8");
const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";

const LayoutItemStub = ({ children, label }: any) =>
  React.createElement("div", { "data-layout-item": label ?? "" }, children);

const LinkToMoisStub = ({ moisModule, objectId }: any) =>
  React.createElement("button", {
    type: "button",
    "data-mois-module": moisModule,
    "data-mois-object": objectId == null ? "" : String(objectId),
  });

/** Captured props of every engine `Markdown` control the component renders. */
type EngineCall = { source: string; markdownProps: any };

function loadPreviewScope() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "LayoutItem",
    "LinkToMois",
    "Markdown",
    "ReactMarkdown",
    "remarkGfm",
    "rehypeRaw",
    `${compiled};\nreturn { RichMarkdownBlock };`
  );
  const EngineMarkdownShouldNotRender = () => {
    throw new Error("preview scope must render through ReactMarkdown");
  };
  return factory(
    React,
    LayoutItemStub,
    LinkToMoisStub,
    EngineMarkdownShouldNotRender,
    ReactMarkdown,
    remarkGfm,
    rehypeRaw
  ).RichMarkdownBlock as React.ComponentType<any>;
}

function loadEngineScope(calls: EngineCall[]) {
  const MarkdownStub = ({ source: markdownSource, markdownProps }: any) => {
    calls.push({ source: markdownSource, markdownProps });
    return React.createElement("div", { "data-engine-markdown": markdownSource });
  };
  // Exactly the engine's namespace list: no ReactMarkdown, no plugins.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "LayoutItem",
    "LinkToMois",
    "Markdown",
    `${compiled};\nreturn { RichMarkdownBlock };`
  );
  return factory(React, LayoutItemStub, LinkToMoisStub, MarkdownStub)
    .RichMarkdownBlock as React.ComponentType<any>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(element: React.ReactElement) {
  act(() => {
    root.render(element);
  });
}

const TABLE_SOURCE = [
  "Intro paragraph.",
  "",
  "| Measure | **Value** |",
  "| --- | ---: |",
  "| Weight | 82 kg |",
  "| Note | see [chart](mois:MEASUREMENTS) |",
  "",
  "Closing paragraph.",
].join("\n");

describe("RichMarkdownBlock — preview scope (ReactMarkdown available)", () => {
  it("renders mois: links as LinkToMois buttons and leaves plain links alone", () => {
    const Block = loadPreviewScope();
    render(
      React.createElement(Block, {
        fieldId: "guidance",
        source:
          "Review [](mois:CHARTACTION), open [Goals](mois:GOALS/12345), and read [the policy](https://example.com).",
      })
    );

    const buttons = container.querySelectorAll("button[data-mois-module]");
    expect(Array.from(buttons).map((b) => b.getAttribute("data-mois-module"))).toEqual([
      "CHARTACTION",
      "GOALS",
    ]);
    expect(buttons[1].getAttribute("data-mois-object")).toBe("12345");

    const anchors = Array.from(container.querySelectorAll("a"));
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute("href")).toBe("https://example.com");
    expect(anchors[0].textContent).toBe("the policy");
  });

  it("does not leak react-markdown's node prop onto DOM elements", () => {
    const Block = loadPreviewScope();
    render(
      React.createElement(Block, {
        fieldId: "guidance",
        source: "Paragraph with a [link](https://example.com).\n\n- one\n- two\n",
      })
    );

    expect(container.querySelectorAll("[node]")).toHaveLength(0);
    expect(container.innerHTML).not.toContain("node=");
  });

  it("renders reserved text-color links and legacy color spans as styled text", () => {
    const Block = loadPreviewScope();
    render(
      React.createElement(Block, {
        fieldId: "guidance",
        source:
          'A [purple phrase](#mois-text-color:5c2d91) and <span style="color:#107c10">green phrase</span>.',
      })
    );

    const colored = Array.from(container.querySelectorAll("span")).filter((node) => node.style.color);
    expect(colored.map((node) => [node.textContent, node.style.color])).toEqual([
      ["purple phrase", "#5c2d91"],
      ["green phrase", "#107c10"],
    ]);
    expect(container.querySelectorAll('a[href*="mois-text-color"]')).toHaveLength(0);
  });

  it("renders GFM tables through remark-gfm", () => {
    const Block = loadPreviewScope();
    render(React.createElement(Block, { fieldId: "guidance", source: TABLE_SOURCE }));

    const headers = Array.from(container.querySelectorAll("th")).map((th) => th.textContent);
    expect(headers).toEqual(["Measure", "Value"]);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.querySelector("button[data-mois-module]")?.getAttribute("data-mois-module")).toBe(
      "MEASUREMENTS"
    );
  });
});

describe("RichMarkdownBlock — engine scope (MOIS form scope)", () => {
  it("renders through the engine Markdown control instead of dropping to raw text", () => {
    const calls: EngineCall[] = [];
    const Block = loadEngineScope(calls);
    render(
      React.createElement(Block, {
        fieldId: "guidance",
        source: "Review [](mois:CHARTACTION) before signing.",
      })
    );

    expect(calls).toHaveLength(1);
    // The reserved scheme travels as a fragment so react-markdown 7's URI
    // sanitiser (which has no urlTransform prop) leaves it intact.
    expect(calls[0].source).toContain("](#mois:CHARTACTION)");
    expect(calls[0].source).not.toContain("](mois:");
    expect(container.querySelector("[data-engine-markdown]")).not.toBeNull();
  });

  it("passes an anchor renderer that turns the fragment-escaped scheme into a chart link", () => {
    const calls: EngineCall[] = [];
    const Block = loadEngineScope(calls);
    render(
      React.createElement(Block, {
        fieldId: "guidance",
        source: "Review [](mois:GOALS/12345).",
      })
    );

    const Anchor = calls[0].markdownProps.components.a;
    render(React.createElement(Anchor, { href: "#mois:GOALS/12345" }, []));
    const button = container.querySelector("button[data-mois-module]");
    expect(button?.getAttribute("data-mois-module")).toBe("GOALS");
    expect(button?.getAttribute("data-mois-object")).toBe("12345");

    render(React.createElement(Anchor, { href: "https://example.com" }, "policy"));
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
  });

  it("passes an anchor renderer that turns color fragments into styled text", () => {
    const calls: EngineCall[] = [];
    const Block = loadEngineScope(calls);
    render(
      React.createElement(Block, {
        fieldId: "guidance",
        source: 'Use <span style="color:#d13438">urgent text</span>.',
      })
    );

    expect(calls[0].source).toContain("[urgent text](#mois-text-color:d13438)");
    const Anchor = calls[0].markdownProps.components.a;
    render(React.createElement(Anchor, { href: "#mois-text-color:d13438" }, "urgent text"));
    const colored = Array.from(container.querySelectorAll("span")).find(
      (node) => node.textContent === "urgent text"
    );
    expect(colored?.style.color).toBe("#d13438");
    expect(container.querySelector('a[href*="mois-text-color"]')).toBeNull();
  });

  it("renders GFM tables itself, because the engine has no remark-gfm", () => {
    const calls: EngineCall[] = [];
    const Block = loadEngineScope(calls);
    render(React.createElement(Block, { fieldId: "guidance", source: TABLE_SOURCE }));

    const headers = Array.from(container.querySelectorAll("th")).map((th) => th.textContent);
    expect(headers).toEqual(["Measure", "Value"]);

    const rows = Array.from(container.querySelectorAll("tbody tr")).map((row) =>
      Array.from(row.querySelectorAll("td")).map((td) => td.textContent)
    );
    expect(rows[0]).toEqual(["Weight", "82 kg"]);
    expect(container.querySelector("th:nth-child(2)")?.querySelector("strong")?.textContent).toBe("Value");
    expect(container.querySelector("tbody button[data-mois-module]")?.getAttribute("data-mois-module")).toBe(
      "MEASUREMENTS"
    );

    // The table block never reaches the markdown control; the prose around it does.
    const engineSources = calls.map((call) => call.source);
    expect(engineSources.some((text) => text.includes("| Weight |"))).toBe(false);
    expect(engineSources.join("\n")).toContain("Intro paragraph.");
    expect(engineSources.join("\n")).toContain("Closing paragraph.");
  });

  it("keeps plain markdown in a single control when there is no table", () => {
    const calls: EngineCall[] = [];
    const Block = loadEngineScope(calls);
    render(
      React.createElement(Block, {
        fieldId: "guidance",
        source: "## Heading\n\n- one\n- two\n",
      })
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].source).toBe("## Heading\n\n- one\n- two\n");
    expect(container.querySelectorAll("table")).toHaveLength(0);
  });
});
