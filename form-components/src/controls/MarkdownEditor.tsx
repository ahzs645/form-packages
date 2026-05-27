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

import React, { useEffect, useRef, useState } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history } from "@milkdown/kit/plugin/history";
import { replaceAll } from "@milkdown/kit/utils";

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
}

const STYLE_ELEMENT_ID = "mois-md-editor-styles";

const EDITOR_STYLES = `
.mois-md-editor{border:1px solid rgb(226 232 240);border-radius:0.75rem;background:#fff;overflow:hidden}
.dark .mois-md-editor{border-color:rgb(51 65 85);background:rgb(15 23 42)}
.mois-md-editor.is-borderless{border-color:transparent;background:transparent}
.mois-md-editor__bar{display:flex;justify-content:flex-end;padding:0.25rem 0.375rem;border-bottom:1px solid rgb(241 245 249)}
.dark .mois-md-editor__bar{border-color:rgb(30 41 59)}
.mois-md-editor.is-borderless .mois-md-editor__bar{border-bottom:none}
.mois-md-editor__toggle{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:rgb(71 85 105);padding:0.2rem 0.5rem;border-radius:0.375rem;background:transparent;border:none;cursor:pointer}
.mois-md-editor__toggle:hover{background:rgb(241 245 249);color:rgb(30 41 59)}
.dark .mois-md-editor__toggle{color:rgb(148 163 184)}
.dark .mois-md-editor__toggle:hover{background:rgb(30 41 59);color:rgb(226 232 240)}
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
}

/** The actual Milkdown instance — must render inside a <MilkdownProvider>. */
function MarkdownEditorInner({ value, onChange, disabled, gfm: gfmEnabled, ariaLabel }: InnerProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(Boolean(disabled));
  disabledRef.current = Boolean(disabled);
  // Tracks the last Markdown we surfaced to the parent so external `value`
  // updates can be told apart from our own edits (prevents a feedback loop).
  const lastEmittedRef = useRef<string>(value ?? "");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, getInstance] = useInstance();

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
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"wysiwyg" | "source">(startInSource ? "source" : "wysiwyg");
  // Milkdown initialises against the DOM in an effect, so defer rendering it
  // until mounted to keep SSR output to an empty shell.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    ensureStyles();
    setMounted(true);
  }, []);

  const wrapperClass = ["mois-md-editor", borderless ? "is-borderless" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  const areaStyle = height ? { minHeight: `${height}px` } : undefined;

  return (
    <div className={wrapperClass}>
      <div className="mois-md-editor__bar">
        <button
          type="button"
          className="mois-md-editor__toggle"
          aria-pressed={mode === "source"}
          onClick={() => setMode((m) => (m === "source" ? "wysiwyg" : "source"))}
          title={mode === "source" ? "Switch to rich text" : "Edit raw Markdown"}
        >
          {mode === "source" ? "Rich text" : "</> Source"}
        </button>
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
