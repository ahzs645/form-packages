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
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from "@milkdown/kit/core";
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
  /** Optional host-app tooltip renderer for toolbar controls. */
  renderTooltip?: MarkdownEditorTooltipRenderer;
}

export type MarkdownEditorTooltipRenderer = (label: string, trigger: React.ReactElement) => React.ReactNode;

const STYLE_ELEMENT_ID = "mois-md-editor-styles";

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
.mois-md-editor__mois-icon{width:16px;height:16px;display:block}
.mois-md-editor__module-menu{position:absolute;right:0;top:calc(100% + 0.35rem);z-index:60;width:15rem;max-height:18rem;overflow:auto;border:1px solid rgb(226 232 240);border-radius:0.5rem;background:white;padding:0.25rem;box-shadow:0 16px 36px rgba(15,23,42,0.18)}
.dark .mois-md-editor__module-menu{border-color:rgb(51 65 85);background:rgb(15 23 42)}
.mois-md-editor__module-option{display:flex;width:100%;align-items:center;gap:0.5rem;border:0;border-radius:0.375rem;background:transparent;padding:0.45rem 0.55rem;text-align:left;color:rgb(51 65 85);font-size:12px;font-weight:600;cursor:pointer}
.mois-md-editor__module-option:hover{background:rgb(241 245 249);color:rgb(15 23 42)}
.dark .mois-md-editor__module-option{color:rgb(226 232 240)}
.dark .mois-md-editor__module-option:hover{background:rgb(30 41 59);color:rgb(248 250 252)}
.mois-md-editor__separator{width:1px;height:1.25rem;margin:0 0.2rem;background:rgb(203 213 225)}
.dark .mois-md-editor__separator{background:rgb(51 65 85)}
.mois-md-editor__tooltip{position:absolute;left:50%;bottom:calc(100% + 0.35rem);z-index:50;transform:translateX(-50%);white-space:nowrap;border-radius:0.375rem;background:rgb(15 23 42);color:white;padding:0.25rem 0.45rem;font-size:11px;font-weight:600;line-height:1;box-shadow:0 6px 16px rgba(15,23,42,0.18);opacity:0;pointer-events:none;transition:opacity 120ms ease, transform 120ms ease}
.mois-md-editor__tool-wrap:hover .mois-md-editor__tooltip,.mois-md-editor__tool-wrap:focus-within .mois-md-editor__tooltip{opacity:1;transform:translateX(-50%) translateY(-1px)}
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

interface InnerProps {
  value: string;
  onChange: (markdown: string) => void;
  disabled?: boolean;
  gfm: boolean;
  ariaLabel?: string;
  onCommandReady?: (runner: CommandRunner | null) => void;
}

type MilkdownAction = (ctx: Ctx) => unknown;
type CommandRunner = (action: MilkdownAction) => void;

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
function MarkdownEditorInner({ value, onChange, disabled, gfm: gfmEnabled, ariaLabel, onCommandReady }: InnerProps) {
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(Boolean(disabled));
  // Tracks the last Markdown we surfaced to the parent so external `value`
  // updates can be told apart from our own edits (prevents a feedback loop).
  const lastEmittedRef = useRef<string>(value ?? "");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    disabledRef.current = Boolean(disabled);
  }, [disabled]);

  useEditor((root) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value ?? "");
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !disabledRef.current,
          attributes: { class: "milkdown-prose", "aria-label": ariaLabel ?? "Markdown editor" },
        }));
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown === prevMarkdown) return;
          const clean = sanitizeMoisMarkdown(markdown);
          lastEmittedRef.current = clean;
          onChangeRef.current?.(clean);
        });
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
    return () => onCommandReady?.(null);
  }, [getInstance, loading, onCommandReady]);

  useEffect(() => {
    if (loading) return;
    const next = value ?? "";
    if (next === lastEmittedRef.current) return;
    const editor = getInstance();
    if (!editor) return;
    // Set before replaceAll so the markdownUpdated listener can refine it to the
    // canonical/sanitised form; guards against re-running on no-op replacements.
    lastEmittedRef.current = next;
    editor.action(replaceAll(next));
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
  renderTooltip,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"wysiwyg" | "source">(startInSource ? "source" : "wysiwyg");
  const [commandRunner, setCommandRunner] = useState<CommandRunner | null>(null);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  // Milkdown initialises against the DOM in an effect, so defer rendering it
  // until mounted to keep SSR output to an empty shell.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    ensureStyles();
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
  const toolbarDisabled = disabled || !commandRunner;
  const handleCommandReady = useCallback((runner: CommandRunner | null) => {
    setCommandRunner(() => runner);
  }, []);
  const insertMoisModuleLink = useCallback(
    (module: string) => {
      const insertion = `[](mois:${module})`;
      const next = value.trim() ? `${value.replace(/\s*$/, "")} ${insertion}` : insertion;
      onChange(next);
      setModuleMenuOpen(false);
    },
    [onChange, value]
  );

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
                  <div className="mois-md-editor__module-menu" role="menu">
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
