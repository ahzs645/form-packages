"use client";

/**
 * MarkdownEditor
 *
 * Shared Milkdown-based WYSIWYG editor for the MOIS Markdown surfaces. Markdown
 * is the source of truth: the editor is controlled via `value` / `onChange`,
 * and serialised output is run through `sanitizeMoisMarkdown` so it stays within
 * the MOIS-supported subset (notably: no strikethrough).
 *
 * A "Source" toggle swaps the WYSIWYG view for a raw Markdown textarea as an
 * escape hatch for power users / paste-and-clean workflows.
 *
 * Headless build (no Crepe / theme): commonmark + (optional) GFM tables, styled
 * with a self-contained injected stylesheet so the component works across the
 * Next and Vite consumers without relying on bundler CSS handling.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, serializerCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import {
  createCodeBlockCommand,
  insertHrCommand,
  insertImageCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
  commonmark,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand, gfm } from "@milkdown/kit/preset/gfm";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history, redoCommand, undoCommand } from "@milkdown/kit/plugin/history";
import { callCommand, replaceAll } from "@milkdown/kit/utils";

import { MOIS_MODULE_LABELS, MOIS_MODULES } from "../components/LinkToMois";
import { sanitizeMoisMarkdown } from "./markdown-sanitize";

export interface MarkdownEditorProps {
  /** Current Markdown value (controlled). */
  value: string;
  /** Called with sanitised Markdown whenever the content changes. */
  onChange: (markdown: string) => void;
  /** Placeholder shown in the raw source textarea. */
  placeholder?: string;
  /** Disable editing. */
  disabled?: boolean;
  /** Enable GFM tables / task lists. Off for surfaces whose renderer is commonmark-only. Default true. */
  gfm?: boolean;
  /** Min height for the editing area, in px. */
  height?: number | null;
  /** Render without the outer border/background. */
  borderless?: boolean;
  /** Start in raw-source mode instead of WYSIWYG. */
  startInSource?: boolean;
  /** Accessible label for the editing region. */
  ariaLabel?: string;
  /** Extra class names on the wrapper. */
  className?: string;
  /** Show MOIS module insertion control in the formatting toolbar. */
  allowMoisLinks?: boolean;
  /**
   * Background behind the whole block, offered beside the text colours.
   *
   * This is a property of the field rather than of a text range — markdown
   * cannot express a highlight — so the host owns the value and this control
   * only sets it. Omit the prop and no highlight control is drawn.
   */
  blockHighlight?: {
    value?: string | null;
    onChange: (value: string | null) => void;
  };
  /**
   * Point size for the whole block, offered beside the highlight.
   *
   * Like the highlight this belongs to the field rather than to a text range,
   * and it means something only where the target measures text in points, so
   * the host supplies the label as well as the value.
   */
  blockFontSize?: {
    value?: number | null;
    onChange: (points: number) => void;
    label?: string;
    min?: number;
    max?: number;
  };
  /** Optional host-app tooltip renderer for toolbar controls. */
  renderTooltip?: MarkdownEditorTooltipRenderer;
  /** Emit Markdown on every editor change. Disable for large documents and flush manually. Default true. */
  liveUpdates?: boolean;
  /** Receives a function that serializes and returns the current editor Markdown. */
  onFlushReady?: (flush: (() => string | null) | null) => void;
  /** Called after editor document changes without forcing Markdown serialization. */
  onEdit?: () => void;
}

export type MarkdownEditorTooltipRenderer = (label: string, trigger: React.ReactElement) => React.ReactNode;

const STYLE_ELEMENT_ID = "mois-md-editor-styles";
const EMPTY_MOIS_LINK_PATTERN = /\[\]\((mois:[^)]+)\)/gi;
const PLACEHOLDER_MOIS_LINK_PATTERN = /\[\u200B\]\((mois:[^)]+)\)/gi;
const DISPLAY_MOIS_LINK_PATTERN = /\[MOIS: [^\]]+\]\((mois:[^)]+)\)/gi;
const COLOR_HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const BLOCK_HIGHLIGHT_OPTIONS = [
  { label: "Yellow", value: "#ffff80" },
  { label: "Orange", value: "#ffc069" },
  { label: "Red", value: "#ff8080" },
  { label: "Green", value: "#b7f7c2" },
  { label: "Blue", value: "#b3d9ff" },
] as const;

const TEXT_COLOR_OPTIONS = [
  { label: "Red", value: "#d13438" },
  { label: "Amber", value: "#986f0b" },
  { label: "Green", value: "#107c10" },
  { label: "Blue", value: "#0078d4" },
  { label: "Purple", value: "#5c2d91" },
  { label: "Black", value: "#323130" },
] as const;

const EDITOR_STYLES = `
.mois-md-editor{border:1px solid rgb(226 232 240);border-radius:0.75rem;background:#fff;overflow:visible}
.dark .mois-md-editor{border-color:rgb(51 65 85);background:rgb(15 23 42)}
.mois-md-editor.is-borderless{border-color:transparent;background:transparent}
.mois-md-editor__toolbar{display:flex;align-items:center;gap:0.125rem;flex-wrap:wrap;padding:0.25rem 0.375rem;border-bottom:1px solid rgb(241 245 249);background:rgb(248 250 252)}
.dark .mois-md-editor__toolbar{border-color:rgb(30 41 59);background:rgb(2 6 23)}
.mois-md-editor.is-borderless .mois-md-editor__toolbar{border-bottom:none}
.mois-md-editor__toolbar-spacer{flex:1 1 auto;min-width:0}
.mois-md-editor__tool-wrap{position:relative;display:inline-flex}
.mois-md-editor__tool{display:inline-flex;align-items:center;justify-content:center;min-width:1.85rem;height:1.85rem;border:0;border-radius:0.375rem;background:transparent;color:rgb(51 65 85);font-size:13px;font-weight:700;line-height:1;cursor:pointer}
.mois-md-editor__tool:hover:not(:disabled){background:rgb(226 232 240);color:rgb(15 23 42)}
.mois-md-editor__tool[aria-pressed="true"]{background:rgb(219 234 254);color:rgb(29 78 216)}
.mois-md-editor__tool:disabled{opacity:0.35;cursor:not-allowed}
.dark .mois-md-editor__tool{color:rgb(203 213 225)}
.dark .mois-md-editor__tool:hover:not(:disabled){background:rgb(30 41 59);color:rgb(248 250 252)}
.dark .mois-md-editor__tool[aria-pressed="true"]{background:rgb(30 58 138);color:rgb(219 234 254)}
.mois-md-editor__tool.is-wide{min-width:auto;padding:0 0.45rem;font-size:11px;text-transform:uppercase;letter-spacing:0.03em}
.mois-md-editor__color-group{display:inline-flex;align-items:center;gap:0.125rem}
.mois-md-editor__color-swatch{display:inline-flex;align-items:center;justify-content:center;width:1.85rem;height:1.85rem;border:0;border-radius:0.375rem;background:transparent;cursor:pointer}
.mois-md-editor__color-swatch:hover:not(:disabled){background:rgb(226 232 240)}
.dark .mois-md-editor__color-swatch:hover:not(:disabled){background:rgb(30 41 59)}
.mois-md-editor__color-swatch:disabled{opacity:0.35;cursor:not-allowed}
.mois-md-editor__color-dot{width:0.95rem;height:0.95rem;border-radius:999px;border:1px solid rgba(15,23,42,0.22);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.5)}
.mois-md-editor__color-dot.is-square{border-radius:0.2rem}
.mois-md-editor__color-swatch[aria-pressed="true"]{background:rgb(219 234 254)}
.dark .mois-md-editor__color-swatch[aria-pressed="true"]{background:rgb(30 58 138)}
.dark .mois-md-editor__color-dot{border-color:rgba(226,232,240,0.35)}
.mois-md-editor__color-input{width:1.85rem;height:1.85rem;border:0;border-radius:0.375rem;background:transparent;padding:0.35rem;cursor:pointer}
.mois-md-editor__color-input:hover:not(:disabled){background:rgb(226 232 240)}
.dark .mois-md-editor__color-input:hover:not(:disabled){background:rgb(30 41 59)}
.mois-md-editor__color-input:disabled{opacity:0.35;cursor:not-allowed}
.mois-md-editor__color-trigger{display:inline-flex;align-items:center;gap:0.15rem;min-width:auto;padding:0 0.3rem}
.mois-md-editor__color-bar{display:block;width:0.95rem;height:0.3rem;border-radius:0.1rem;border:1px solid rgba(15,23,42,0.18)}
.mois-md-editor__color-caret{font-size:8px;line-height:1;opacity:0.65}
.mois-md-editor__color-menu{position:absolute;left:0;top:calc(100% + 0.35rem);z-index:60;width:max-content;border:1px solid rgb(226 232 240);border-radius:0.5rem;background:white;padding:0.5rem;box-shadow:0 16px 36px rgba(15,23,42,0.18)}
.dark .mois-md-editor__color-menu{border-color:rgb(51 65 85);background:rgb(15 23 42)}
.mois-md-editor__color-menu-title{display:block;margin-bottom:0.35rem;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:rgb(100 116 139)}
.mois-md-editor__color-grid{display:grid;grid-template-columns:repeat(6,1.85rem);gap:0.15rem}
.mois-md-editor__color-menu-row{display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-top:0.45rem;padding-top:0.45rem;border-top:1px solid rgb(241 245 249);font-size:11px;font-weight:600;color:rgb(51 65 85)}
.dark .mois-md-editor__color-menu-row{border-color:rgb(30 41 59);color:rgb(203 213 225)}
.mois-md-editor__color-menu-clear{border:0;border-radius:0.375rem;background:transparent;padding:0.2rem 0.4rem;font-size:11px;font-weight:600;color:rgb(51 65 85);cursor:pointer}
.mois-md-editor__color-menu-clear:hover{background:rgb(241 245 249)}
.dark .mois-md-editor__color-menu-clear{color:rgb(203 213 225)}
.dark .mois-md-editor__color-menu-clear:hover{background:rgb(30 41 59)}
.mois-md-editor__size-input{width:3rem;height:1.85rem;border:1px solid rgb(226 232 240);border-radius:0.375rem;background:#fff;padding:0 0.3rem;font-size:11px;font-weight:600;color:rgb(51 65 85)}
.dark .mois-md-editor__size-input{border-color:rgb(51 65 85);background:rgb(15 23 42);color:rgb(226 232 240)}
.mois-md-editor__size-input:disabled{opacity:0.35;cursor:not-allowed}
.mois-md-editor__mois-icon{width:16px;height:16px;display:block}
.milkdown-prose a[href^="mois:"]{display:inline-flex;align-items:center;justify-content:center;width:1.35rem;height:1.35rem;overflow:hidden;vertical-align:-0.25rem;border:1px solid rgb(191 219 254);border-radius:0.3rem;background:rgb(239 246 255) url("/img/GotoRecord.png") center/14px 14px no-repeat;color:transparent;font-size:0;text-decoration:none;cursor:pointer}
.milkdown-prose a[href^="mois:"]:hover{border-color:rgb(96 165 250);background-color:rgb(219 234 254)}
.dark .milkdown-prose a[href^="mois:"]{border-color:rgb(30 58 138);background-color:rgb(30 41 59)}
.mois-md-editor__module-menu{position:absolute;right:0;top:calc(100% + 0.35rem);z-index:60;width:15rem;max-height:18rem;overflow:auto;border:1px solid rgb(226 232 240);border-radius:0.5rem;background:white;padding:0.25rem;box-shadow:0 16px 36px rgba(15,23,42,0.18)}
.mois-md-editor__module-menu.is-context{position:fixed;right:auto;top:auto;z-index:80}
.dark .mois-md-editor__module-menu{border-color:rgb(51 65 85);background:rgb(15 23 42)}
.mois-md-editor__module-option{display:flex;width:100%;align-items:center;gap:0.5rem;border:0;border-radius:0.375rem;background:transparent;padding:0.45rem 0.55rem;text-align:left;color:rgb(51 65 85);font-size:12px;font-weight:600;cursor:pointer}
.mois-md-editor__module-option:hover{background:rgb(241 245 249);color:rgb(15 23 42)}
.dark .mois-md-editor__module-option{color:rgb(226 232 240)}
.dark .mois-md-editor__module-option:hover{background:rgb(30 41 59);color:rgb(248 250 252)}
.mois-md-editor__separator{width:1px;height:1.25rem;margin:0 0.2rem;background:rgb(203 213 225)}
.dark .mois-md-editor__separator{background:rgb(51 65 85)}
.mois-md-editor__tooltip{position:absolute;left:50%;top:calc(100% + 0.35rem);z-index:50;transform:translateX(-50%);white-space:nowrap;border-radius:0.375rem;background:rgb(15 23 42);color:white;padding:0.25rem 0.45rem;font-size:11px;font-weight:600;line-height:1;box-shadow:0 6px 16px rgba(15,23,42,0.18);opacity:0;pointer-events:none;transition:opacity 120ms ease, transform 120ms ease}
.mois-md-editor__tool-wrap:hover .mois-md-editor__tooltip,.mois-md-editor__tool-wrap:focus-within .mois-md-editor__tooltip{opacity:1;transform:translateX(-50%) translateY(1px)}
.dark .mois-md-editor__tooltip{background:rgb(226 232 240);color:rgb(15 23 42)}
.mois-md-editor__source{display:block;width:100%;border:none;outline:none;resize:vertical;padding:0.5rem 0.75rem;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:rgb(15 23 42);background:transparent}
.dark .mois-md-editor__source{color:rgb(226 232 240)}
.mois-md-editor__loading{padding:0.75rem;font-size:13px;color:rgb(100 116 139)}
.mois-md-editor .ProseMirror{white-space:pre-wrap;word-wrap:break-word;font-variant-ligatures:none;padding:0.5rem 0.75rem;outline:none;color:rgb(15 23 42)}
.dark .mois-md-editor .ProseMirror{color:rgb(226 232 240)}
.mois-md-editor .ProseMirror:focus{outline:none}
.mois-md-editor .ProseMirror>*+*{margin-top:0.6em}
.mois-md-editor .ProseMirror h1{font-size:1.4em;font-weight:700}
.mois-md-editor .ProseMirror h2{font-size:1.2em;font-weight:700}
.mois-md-editor .ProseMirror h3{font-size:1.05em;font-weight:600}
.mois-md-editor .ProseMirror ul{list-style:disc;padding-left:1.4em}
.mois-md-editor .ProseMirror ol{list-style:decimal;padding-left:1.4em}
.mois-md-editor .ProseMirror a{color:rgb(37 99 235);text-decoration:underline}
.mois-md-editor .ProseMirror a[href^="mois:"]{display:inline-flex;align-items:center;min-height:18px;margin:0 0.125rem;padding-left:20px;vertical-align:middle;background:url("/img/GotoRecord.png") left center/16px 16px no-repeat;color:rgb(37 99 235);text-decoration:underline}
.mois-md-editor .ProseMirror a[href^="mois:"]::selection{background:rgba(37,99,235,0.25);color:rgb(30 64 175)}
.mois-md-editor .ProseMirror blockquote{border-left:3px solid rgb(203 213 225);padding-left:0.75em;color:rgb(71 85 105)}
.mois-md-editor .ProseMirror code{font-family:ui-monospace,Menlo,monospace;font-size:0.9em;background:rgb(241 245 249);padding:0.1em 0.3em;border-radius:0.25rem}
.dark .mois-md-editor .ProseMirror code{background:rgb(30 41 59)}
.mois-md-editor .ProseMirror pre{background:rgb(241 245 249);padding:0.6em 0.8em;border-radius:0.5rem;overflow:auto}
.dark .mois-md-editor .ProseMirror pre{background:rgb(2 6 23)}
.mois-md-editor .ProseMirror pre code{background:transparent;padding:0}
.mois-md-editor .ProseMirror table{border-collapse:collapse;width:100%}
.mois-md-editor .ProseMirror th,.mois-md-editor .ProseMirror td{border:1px solid rgb(203 213 225);padding:0.3em 0.5em}
.dark .mois-md-editor .ProseMirror th,.dark .mois-md-editor .ProseMirror td{border-color:rgb(51 65 85)}
.mois-md-editor .ProseMirror hr{border:none;border-top:1px solid rgb(203 213 225)}
`;

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = EDITOR_STYLES;
  document.head.appendChild(style);
}

function toEditorMarkdown(markdown: string): string {
  if (!markdown) return markdown;
  return markdown.replace(EMPTY_MOIS_LINK_PATTERN, (_match, href: string) => {
    const moduleName = href.replace(/^mois:/i, "");
    return `[${getMoisEditorLabel(moduleName)}](${href})`;
  });
}

function fromEditorMarkdown(markdown: string): string {
  if (!markdown) return markdown;
  return sanitizeMoisMarkdown(markdown)
    .replace(PLACEHOLDER_MOIS_LINK_PATTERN, "[]($1)")
    .replace(DISPLAY_MOIS_LINK_PATTERN, "[]($1)");
}

function getMoisEditorLabel(module: string): string {
  const normalized = module.trim().toUpperCase();
  return `MOIS: ${MOIS_MODULE_LABELS[normalized] ?? normalized.replace(/_/g, " ")}`;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeTextColor(value: string): string | null {
  const trimmed = value.trim();
  return COLOR_HEX_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

interface InnerProps {
  value: string;
  onChange: (markdown: string) => void;
  disabled?: boolean;
  gfm: boolean;
  ariaLabel?: string;
  onCommandReady?: (runner: CommandRunner | null) => void;
  liveUpdates: boolean;
  onFlushReady?: (flush: (() => string | null) | null) => void;
  onEdit?: () => void;
  onMoisLinkContextMenu?: (event: { x: number; y: number; module: string; from: number; to: number }) => void;
}

type MilkdownAction = (ctx: Ctx) => unknown;
type CommandRunner = (action: MilkdownAction) => void;

function updateMoisLinkAtSelection(ctx: Ctx, module: string): boolean {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const linkType = state.schema.marks.link;
  if (!linkType) return false;

  const href = `mois:${module}`;
  const label = getMoisEditorLabel(module);
  const { from, to, empty, $from } = state.selection;

  if (!empty) {
    const tr = state.tr.insertText(label, from, to);
    tr.addMark(from, from + label.length, linkType.create({ href }));
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
  }

  const parent = $from.parent;
  let index = $from.index();
  let current = parent.childAfter($from.parentOffset);
  if (!current.node && $from.parentOffset > 0) {
    current = parent.childBefore($from.parentOffset);
    index -= 1;
  }
  const mark = current.node?.marks.find(
    (candidate: { type: unknown; attrs?: { href?: string } }) =>
      candidate.type === linkType && /^mois:/i.test(candidate.attrs?.href ?? "")
  );
  if (!current.node || !mark) return false;

  let start = $from.start() + current.offset;
  let end = start + current.node.nodeSize;

  while (index > 0 && mark.isInSet(parent.child(index - 1).marks)) {
    index -= 1;
    start -= parent.child(index).nodeSize;
  }
  while (index + 1 < parent.childCount && mark.isInSet(parent.child(index + 1).marks)) {
    index += 1;
    end += parent.child(index).nodeSize;
  }

  const tr = state.tr.insertText(label, start, end);
  tr.addMark(start, start + label.length, linkType.create({ href }));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Insert a module link at the cursor as a single transaction.
 *
 * The alternative — rewriting the markdown and calling `replaceAll` — re-parses
 * and re-renders the whole document, which is a visible stall on a form of any
 * size and happens twice, since the host's `onChange` then feeds the new value
 * back in. A transaction touches only the selection.
 */
function insertMoisLinkAtSelection(ctx: Ctx, module: string): boolean {
  const view = ctx.get(editorViewCtx);
  const linkType = view.state.schema.marks.link;
  if (!linkType) return false;

  const label = getMoisEditorLabel(module);
  const { from, to, empty } = view.state.selection;
  // A link needs a space to live beside when it lands mid-sentence.
  const prefix = empty && from > 1 && view.state.doc.textBetween(from - 1, from) !== " " ? " " : "";
  const text = `${prefix}${label}`;
  const tr = view.state.tr.insertText(text, from, to);
  const start = from + prefix.length;
  tr.addMark(start, start + label.length, linkType.create({ href: `mois:${module}` }));
  // Leave the caret after the link rather than inside its mark, so the next
  // thing typed is ordinary text.
  tr.removeStoredMark(linkType);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function updateMoisLinkAtRange(ctx: Ctx, module: string, from: number, to: number): boolean {
  const view = ctx.get(editorViewCtx);
  const linkType = view.state.schema.marks.link;
  if (!linkType || from >= to) return false;

  const label = getMoisEditorLabel(module);
  const tr = view.state.tr.insertText(label, from, to);
  tr.addMark(from, from + label.length, linkType.create({ href: `mois:${module}` }));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function applyTextColorAtSelection(ctx: Ctx, color: string): boolean {
  const safeColor = normalizeTextColor(color);
  if (!safeColor) return false;

  const view = ctx.get(editorViewCtx);
  const htmlType = view.state.schema.nodes.html;
  if (!htmlType) return false;

  const { from, to, empty } = view.state.selection;
  const selectedText = empty ? "colored text" : view.state.doc.textBetween(from, to, "\n");
  const html = `<span style="color:${safeColor}">${escapeHtmlText(selectedText || "colored text")}</span>`;
  const tr = view.state.tr.replaceWith(from, to, htmlType.create({ value: html }));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function findMoisAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href^='mois:']");
  return anchor instanceof HTMLAnchorElement ? anchor : null;
}

interface ToolbarButtonProps {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
  renderTooltip?: MarkdownEditorTooltipRenderer;
}

function ToolbarButton({ label, children, onClick, disabled, pressed, className, renderTooltip }: ToolbarButtonProps) {
  const button = (
    <button
      type="button"
      className={["mois-md-editor__tool", className ?? ""].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );

  if (renderTooltip) {
    return <>{renderTooltip(label, button)}</>;
  }

  return (
    <span className="mois-md-editor__tool-wrap">
      {button}
      <span role="tooltip" className="mois-md-editor__tooltip">
        {label}
      </span>
    </span>
  );
}

/** The actual Milkdown instance — must render inside a <MilkdownProvider>. */
function MarkdownEditorInner({
  value,
  onChange,
  disabled,
  gfm: gfmEnabled,
  ariaLabel,
  onCommandReady,
  liveUpdates,
  onFlushReady,
  onEdit,
  onMoisLinkContextMenu,
}: InnerProps) {
  const onChangeRef = useRef(onChange);
  const onEditRef = useRef(onEdit);
  const onMoisLinkContextMenuRef = useRef(onMoisLinkContextMenu);
  const disabledRef = useRef(Boolean(disabled));
  const editorValue = toEditorMarkdown(value ?? "");
  // Tracks the last Markdown we surfaced to the parent so external `value`
  // updates can be told apart from our own edits (prevents a feedback loop).
  const lastEmittedRef = useRef<string>(value ?? "");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  useEffect(() => {
    onMoisLinkContextMenuRef.current = onMoisLinkContextMenu;
  }, [onMoisLinkContextMenu]);

  useEffect(() => {
    disabledRef.current = Boolean(disabled);
  }, [disabled]);

  useEditor((root) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, editorValue);
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !disabledRef.current,
          attributes: { class: "milkdown-prose", "aria-label": ariaLabel ?? "Markdown editor" },
          handleDOMEvents: {
            ...prev.handleDOMEvents,
            // Both buttons open the module menu: an inserted link is a
            // control, and an author who wants a different module should not
            // have to guess that only the right button offers one.
            click: (view, event) => {
              if ((event as MouseEvent).button !== 0) return false;
              const anchor = findMoisAnchor(event.target);
              const callback = onMoisLinkContextMenuRef.current;
              if (!anchor || !callback || disabledRef.current) return false;
              event.preventDefault();
              // The menu closes on the next window click, so this one must
              // not reach the window that just opened it.
              event.stopPropagation();
              const href = anchor.getAttribute("href") ?? "";
              const text = anchor.textContent ?? "";
              const textNode = anchor.firstChild;
              let from = 0;
              let to = 0;
              if (textNode) {
                from = view.posAtDOM(textNode, 0);
                to = view.posAtDOM(textNode, text.length);
              }
              callback({
                x: (event as MouseEvent).clientX,
                y: (event as MouseEvent).clientY,
                module: href.replace(/^mois:/i, ""),
                from,
                to,
              });
              return true;
            },
            contextmenu: (view, event) => {
              const anchor = findMoisAnchor(event.target);
              const callback = onMoisLinkContextMenuRef.current;
              if (!anchor || !callback || disabledRef.current) return false;

              event.preventDefault();
              const href = anchor.getAttribute("href") ?? "";
              const moduleName = href.replace(/^mois:/i, "");
              const text = anchor.textContent ?? "";
              const textNode = anchor.firstChild;
              let from = 0;
              let to = 0;
              if (textNode) {
                from = view.posAtDOM(textNode, 0);
                to = view.posAtDOM(textNode, text.length);
              }
              callback({ x: event.clientX, y: event.clientY, module: moduleName, from, to });
              return true;
            },
          },
        }));
        if (liveUpdates) {
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
            if (markdown === prevMarkdown) return;
            const clean = fromEditorMarkdown(markdown);
            lastEmittedRef.current = clean;
            onChangeRef.current?.(clean);
          });
        } else {
          ctx.get(listenerCtx).updated(() => {
            onEditRef.current?.();
          });
        }
      })
      .use(commonmark)
      .use(listener)
      .use(history);
    if (gfmEnabled) editor.use(gfm);
    return editor;
    // Create once; external value changes are reconciled by the effect below.
  }, []);

  const [loading, getInstance] = useInstance();

  useEffect(() => {
    if (loading) return;
    const editor = getInstance();
    if (!editor) return;
    onCommandReady?.((action) => editor.action(action));
    onFlushReady?.(() =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const serializer = ctx.get(serializerCtx);
        const clean = fromEditorMarkdown(serializer(view.state.doc));
        lastEmittedRef.current = clean;
        return clean;
      })
    );
    return () => {
      onCommandReady?.(null);
      onFlushReady?.(null);
    };
  }, [getInstance, loading, onCommandReady, onFlushReady]);

  useEffect(() => {
    if (loading) return;
    const next = value ?? "";
    if (next === lastEmittedRef.current) return;
    const editor = getInstance();
    if (!editor) return;
    // Set before replaceAll so the markdownUpdated listener can refine it to the
    // canonical/sanitised form; guards against re-running on no-op replacements.
    lastEmittedRef.current = next;
    editor.action(replaceAll(toEditorMarkdown(next)));
  }, [value, loading, getInstance]);

  return <Milkdown />;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  disabled,
  gfm = true,
  height,
  borderless,
  startInSource = false,
  ariaLabel,
  className,
  allowMoisLinks = false,
  blockHighlight,
  blockFontSize,
  renderTooltip,
  liveUpdates = true,
  onFlushReady,
  onEdit,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"wysiwyg" | "source">(startInSource ? "source" : "wysiwyg");
  const [commandRunner, setCommandRunner] = useState<CommandRunner | null>(null);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  // Colour and highlight are pickers rather than a dozen inline swatches: the
  // toolbar has to stay readable beside everything else on it.
  const [colorMenu, setColorMenu] = useState<"text" | "highlight" | null>(null);
  const [lastTextColor, setLastTextColor] = useState<string>(TEXT_COLOR_OPTIONS[0].value);
  const [moduleContextMenu, setModuleContextMenu] = useState<{
    x: number;
    y: number;
    module: string;
    from: number;
    to: number;
  } | null>(null);
  const flushRef = useRef<(() => string | null) | null>(null);
  // Milkdown initialises against the DOM in an effect, so defer rendering it
  // until mounted to keep SSR output to an empty shell.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    ensureStyles();
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!moduleMenuOpen && !moduleContextMenu && !colorMenu) return;
    const closeMenus = () => {
      setModuleMenuOpen(false);
      setModuleContextMenu(null);
      setColorMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenus();
    };
    window.addEventListener("click", closeMenus);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeMenus);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moduleMenuOpen, moduleContextMenu, colorMenu]);

  const wrapperClass = ["mois-md-editor", borderless ? "is-borderless" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  const areaStyle = height ? { minHeight: `${height}px` } : undefined;
  const runCommand = useCallback(
    <T,>(command: { key: unknown }, payload?: T) => {
      commandRunner?.(callCommand(command.key as never, payload as never));
    },
    [commandRunner]
  );
  const insertLink = useCallback(() => {
    const href = window.prompt("Link URL");
    if (!href) return;
    runCommand(toggleLinkCommand, { href });
  }, [runCommand]);
  const insertImage = useCallback(() => {
    const src = window.prompt("Image URL");
    if (!src) return;
    const alt = window.prompt("Image alt text") ?? "";
    runCommand(insertImageCommand, { src, alt });
  }, [runCommand]);
  const applyTextColor = useCallback(
    (color: string) => {
      commandRunner?.((ctx) => {
        applyTextColorAtSelection(ctx, color);
      });
      onEdit?.();
    },
    [commandRunner, onEdit]
  );
  const toolbarDisabled = disabled || !commandRunner;
  /**
   * The host's tooltip when it supplies one, the inline fallback otherwise.
   * The fallback is a child of the toolbar, so a narrow editor clips it at the
   * pane edge; the host's is portalled and stays visible.
   */
  const withTooltip = (label: string, trigger: React.ReactElement) =>
    renderTooltip ? (
      renderTooltip(label, trigger)
    ) : (
      <>
        {trigger}
        <span role="tooltip" className="mois-md-editor__tooltip">
          {label}
        </span>
      </>
    );
  const handleCommandReady = useCallback((runner: CommandRunner | null) => {
    setCommandRunner(() => runner);
  }, []);
  const handleFlushReady = useCallback(
    (flush: (() => string | null) | null) => {
      flushRef.current = flush;
      onFlushReady?.(flush);
    },
    [onFlushReady]
  );
  const insertMoisModuleLink = useCallback(
    (module: string) => {
      let updatedExistingLink = false;
      if (moduleContextMenu) {
        commandRunner?.((ctx) => {
          updatedExistingLink = updateMoisLinkAtRange(ctx, module, moduleContextMenu.from, moduleContextMenu.to);
        });
      } else {
        commandRunner?.((ctx) => {
          updatedExistingLink = updateMoisLinkAtSelection(ctx, module);
        });
      }
      if (updatedExistingLink) {
        onEdit?.();
        setModuleMenuOpen(false);
        setModuleContextMenu(null);
        return;
      }

      let inserted = false;
      commandRunner?.((ctx) => {
        inserted = insertMoisLinkAtSelection(ctx, module);
      });
      if (inserted) {
        // Flushing serializes once and records what was emitted, so the value
        // coming back from the host is recognised and no re-parse follows.
        const flushed = flushRef.current?.();
        if (typeof flushed === "string") onChange(flushed);
        onEdit?.();
        setModuleMenuOpen(false);
        setModuleContextMenu(null);
        return;
      }

      const label = getMoisEditorLabel(module);
      const insertion = `[${label}](mois:${module})`;
      const current = flushRef.current?.() ?? value;
      const next = current.trim() ? `${current.replace(/\s*$/, "")} ${insertion}` : insertion;
      commandRunner?.(replaceAll(toEditorMarkdown(next)));
      onChange(fromEditorMarkdown(next));
      onEdit?.();
      setModuleMenuOpen(false);
      setModuleContextMenu(null);
    },
    [commandRunner, moduleContextMenu, onChange, onEdit, value]
  );
  const openMoisLinkContextMenu = useCallback((event: { x: number; y: number; module: string; from: number; to: number }) => {
    setModuleMenuOpen(false);
    setModuleContextMenu(event);
  }, []);

  return (
    <div className={wrapperClass}>
      <div className="mois-md-editor__toolbar" aria-label="Text formatting toolbar" onMouseDown={(event) => event.preventDefault()}>
        {mode === "wysiwyg" ? (
          <>
          <ToolbarButton label="Undo" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(undoCommand)}>↶</ToolbarButton>
          <ToolbarButton label="Redo" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(redoCommand)}>↷</ToolbarButton>
          <span className="mois-md-editor__separator" />
          <ToolbarButton label="Bold" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(toggleStrongCommand)}>B</ToolbarButton>
          <ToolbarButton label="Italic" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(toggleEmphasisCommand)}><em>I</em></ToolbarButton>
          <ToolbarButton label="Paragraph" className="is-wide" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(turnIntoTextCommand)}>P</ToolbarButton>
          <ToolbarButton label="Heading 2" className="is-wide" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(wrapInHeadingCommand, 2)}>H2</ToolbarButton>
          <ToolbarButton label="Inline code" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(toggleInlineCodeCommand)}>{"<>"}</ToolbarButton>
          <span className="mois-md-editor__separator" />
          <span className="mois-md-editor__tool-wrap">
            {withTooltip(
              "Text colour",
              <button
                type="button"
                className="mois-md-editor__tool mois-md-editor__color-trigger"
                aria-label="Text colour"
                aria-haspopup="menu"
                aria-expanded={colorMenu === "text"}
                disabled={toolbarDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setColorMenu((current) => (current === "text" ? null : "text"));
                }}
              >
                <span aria-hidden="true">A</span>
                <span className="mois-md-editor__color-bar" style={{ backgroundColor: lastTextColor }} />
                <span className="mois-md-editor__color-caret" aria-hidden="true">▾</span>
              </button>,
            )}
            {colorMenu === "text" ? (
              <div className="mois-md-editor__color-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                <span className="mois-md-editor__color-menu-title">Text colour</span>
                <div className="mois-md-editor__color-grid">
                  {TEXT_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="mois-md-editor__color-swatch"
                      aria-label={`Text color ${option.label}`}
                      title={option.label}
                      onClick={() => {
                        setLastTextColor(option.value);
                        applyTextColor(option.value);
                        setColorMenu(null);
                      }}
                    >
                      <span className="mois-md-editor__color-dot" style={{ backgroundColor: option.value }} />
                    </button>
                  ))}
                </div>
                <div className="mois-md-editor__color-menu-row">
                  <span>Custom</span>
                  <input
                    type="color"
                    className="mois-md-editor__color-input"
                    aria-label="Custom text color"
                    value={lastTextColor}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      setLastTextColor(event.target.value);
                      applyTextColor(event.target.value);
                    }}
                  />
                </div>
              </div>
            ) : null}
          </span>
          {blockHighlight ? (
            <>
              <span className="mois-md-editor__separator" />
              <span className="mois-md-editor__tool-wrap">
                {withTooltip(
                  "Block highlight",
                  <button
                    type="button"
                    className="mois-md-editor__tool mois-md-editor__color-trigger"
                    aria-label="Block highlight"
                    aria-haspopup="menu"
                    aria-expanded={colorMenu === "highlight"}
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      setColorMenu((current) => (current === "highlight" ? null : "highlight"));
                    }}
                  >
                    <span
                      className="mois-md-editor__color-dot is-square"
                      style={{ backgroundColor: blockHighlight.value ?? "transparent" }}
                    />
                    <span className="mois-md-editor__color-caret" aria-hidden="true">▾</span>
                  </button>,
                )}
                {colorMenu === "highlight" ? (
                  <div className="mois-md-editor__color-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                    <span className="mois-md-editor__color-menu-title">Block highlight</span>
                    <div className="mois-md-editor__color-grid">
                      {BLOCK_HIGHLIGHT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="mois-md-editor__color-swatch"
                          aria-label={`Highlight ${option.label}`}
                          title={option.label}
                          aria-pressed={blockHighlight.value?.toLowerCase() === option.value}
                          onClick={() => {
                            blockHighlight.onChange(option.value);
                            setColorMenu(null);
                          }}
                        >
                          <span className="mois-md-editor__color-dot is-square" style={{ backgroundColor: option.value }} />
                        </button>
                      ))}
                    </div>
                    <div className="mois-md-editor__color-menu-row">
                      <span>Custom</span>
                      <input
                        type="color"
                        className="mois-md-editor__color-input"
                        aria-label="Custom highlight"
                        value={blockHighlight.value ?? "#ffff80"}
                        onMouseDown={(event) => event.stopPropagation()}
                        onChange={(event) => blockHighlight.onChange(event.target.value)}
                      />
                    </div>
                    {blockHighlight.value ? (
                      <div className="mois-md-editor__color-menu-row">
                        <button
                          type="button"
                          className="mois-md-editor__color-menu-clear"
                          onClick={() => {
                            blockHighlight.onChange(null);
                            setColorMenu(null);
                          }}
                        >
                          No highlight
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </span>
            </>
          ) : null}
          {blockFontSize ? (
            <>
              <span className="mois-md-editor__separator" />
              <span className="mois-md-editor__tool-wrap">
                {withTooltip(
                  blockFontSize.label ?? "Text size in points",
                  <input
                    type="number"
                    className="mois-md-editor__size-input"
                    aria-label={blockFontSize.label ?? "Text size in points"}
                    min={blockFontSize.min ?? 6}
                    max={blockFontSize.max ?? 36}
                    disabled={disabled}
                    value={blockFontSize.value ?? ""}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const points = Number(event.target.value);
                      if (Number.isFinite(points) && points > 0) blockFontSize.onChange(points);
                    }}
                  />,
                )}
              </span>
            </>
          ) : null}
          <span className="mois-md-editor__separator" />
          <ToolbarButton label="Bullet list" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(wrapInBulletListCommand)}>•</ToolbarButton>
          <ToolbarButton label="Numbered list" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(wrapInOrderedListCommand)}>1.</ToolbarButton>
          <ToolbarButton label="Quote" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(wrapInBlockquoteCommand)}>“”</ToolbarButton>
          <ToolbarButton label="Code block" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(createCodeBlockCommand)}>▣</ToolbarButton>
          <span className="mois-md-editor__separator" />
          <ToolbarButton label="Link" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={insertLink}>🔗</ToolbarButton>
          <ToolbarButton label="Image" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={insertImage}>▧</ToolbarButton>
          <ToolbarButton label="Horizontal rule" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(insertHrCommand)}>―</ToolbarButton>
          {gfm ? (
            <ToolbarButton label="Table" disabled={toolbarDisabled} renderTooltip={renderTooltip} onClick={() => runCommand(insertTableCommand, { row: 3, col: 3 })}>▦</ToolbarButton>
          ) : null}
          {allowMoisLinks ? (
            <>
              <span className="mois-md-editor__separator" />
              <span className="mois-md-editor__tool-wrap">
                {renderTooltip ? (
                  renderTooltip(
                    "MOIS module link",
                    <button
                      type="button"
                      className="mois-md-editor__tool"
                      aria-label="MOIS module link"
                      aria-expanded={moduleMenuOpen}
                      aria-haspopup="menu"
                      disabled={disabled}
                      onClick={() => setModuleMenuOpen((current) => !current)}
                    >
                      <img className="mois-md-editor__mois-icon" src="/img/GotoRecord.png" alt="" />
                    </button>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      className="mois-md-editor__tool"
                      aria-label="MOIS module link"
                      aria-expanded={moduleMenuOpen}
                      aria-haspopup="menu"
                      disabled={disabled}
                      onClick={() => setModuleMenuOpen((current) => !current)}
                    >
                      <img className="mois-md-editor__mois-icon" src="/img/GotoRecord.png" alt="" />
                    </button>
                    <span role="tooltip" className="mois-md-editor__tooltip">
                      MOIS module link
                    </span>
                  </>
                )}
                {moduleMenuOpen ? (
                  <div
                    className="mois-md-editor__module-menu"
                    role="menu"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {MOIS_MODULES.map((module) => (
                      <button
                        key={module}
                        type="button"
                        className="mois-md-editor__module-option"
                        role="menuitem"
                        onClick={() => insertMoisModuleLink(module)}
                      >
                        <img className="mois-md-editor__mois-icon" src="/img/GotoRecord.png" alt="" />
                        {MOIS_MODULE_LABELS[module] ?? module.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                ) : null}
              </span>
            </>
          ) : null}
          </>
        ) : null}
        <span className="mois-md-editor__toolbar-spacer" />
        <ToolbarButton
          label={mode === "source" ? "Switch to rich text" : "Edit raw Markdown"}
          pressed={mode === "source"}
          renderTooltip={renderTooltip}
          onClick={() => setMode((m) => (m === "source" ? "wysiwyg" : "source"))}
        >
          {"</>"}
        </ToolbarButton>
      </div>
      {moduleContextMenu ? (
        <div
          className="mois-md-editor__module-menu is-context"
          role="menu"
          aria-label={`Change MOIS module from ${moduleContextMenu.module}`}
          style={{ left: moduleContextMenu.x, top: moduleContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {MOIS_MODULES.map((module) => (
            <button
              key={module}
              type="button"
              className="mois-md-editor__module-option"
              role="menuitem"
              onClick={() => insertMoisModuleLink(module)}
            >
              <img className="mois-md-editor__mois-icon" src="/img/GotoRecord.png" alt="" />
              {MOIS_MODULE_LABELS[module] ?? module.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "source" ? (
        <textarea
          className="mois-md-editor__source"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          rows={Math.max(4, Math.round((height ?? 0) / 22) || 8)}
          style={areaStyle}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : mounted ? (
        <div style={areaStyle}>
          <MilkdownProvider>
            <MarkdownEditorInner
              value={value}
              onChange={onChange}
              disabled={disabled}
              gfm={gfm}
              ariaLabel={ariaLabel ?? placeholder}
              onCommandReady={handleCommandReady}
              liveUpdates={liveUpdates}
              onFlushReady={handleFlushReady}
              onEdit={onEdit}
              onMoisLinkContextMenu={allowMoisLinks ? openMoisLinkContextMenu : undefined}
            />
          </MilkdownProvider>
        </div>
      ) : (
        <div className="mois-md-editor__loading" style={areaStyle}>
          Loading editor…
        </div>
      )}
    </div>
  );
}

export default MarkdownEditor;
