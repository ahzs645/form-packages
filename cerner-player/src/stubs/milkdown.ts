/**
 * Build-time stub replacing every @milkdown/* specifier via vite aliases.
 * MarkdownEditor is exported from the form-components barrel but is never in
 * the compiled form scope, so the editor cannot render in the player; these
 * inert shapes only need to satisfy module resolution and the component's
 * top-level property access.
 */

type AnyFn = (...args: unknown[]) => unknown;

const noop: AnyFn = () => undefined;
const command = (name: string) => ({ key: name });

// @milkdown/react
export const Milkdown: AnyFn = () => null;
export const MilkdownProvider: AnyFn = (props: unknown) =>
  (props as { children?: unknown })?.children ?? null;
export const useEditor = () => ({ get: () => null, loading: true });
export const useInstance = (): [boolean, () => null] => [true, () => null];

// @milkdown/kit/core
export const Editor = {
  make() {
    const chain = {
      config: () => chain,
      use: () => chain,
      create: async () => null,
    };
    return chain;
  },
};
export const rootCtx = {};
export const defaultValueCtx = {};
export const editorViewCtx = {};
export const editorViewOptionsCtx = {};
export const serializerCtx = {};

// @milkdown/kit/ctx
export type Ctx = unknown;

// @milkdown/kit/preset/commonmark
export const commonmark = {};
export const createCodeBlockCommand = command("createCodeBlock");
export const insertHrCommand = command("insertHr");
export const insertImageCommand = command("insertImage");
export const toggleEmphasisCommand = command("toggleEmphasis");
export const toggleInlineCodeCommand = command("toggleInlineCode");
export const toggleLinkCommand = command("toggleLink");
export const toggleStrongCommand = command("toggleStrong");
export const turnIntoTextCommand = command("turnIntoText");
export const wrapInBlockquoteCommand = command("wrapInBlockquote");
export const wrapInBulletListCommand = command("wrapInBulletList");
export const wrapInHeadingCommand = command("wrapInHeading");
export const wrapInOrderedListCommand = command("wrapInOrderedList");

// @milkdown/kit/preset/gfm
export const gfm = {};
export const insertTableCommand = command("insertTable");

// @milkdown/kit/plugin/listener
export const listener = {};
export const listenerCtx = {};

// @milkdown/kit/plugin/history
export const history = {};
export const redoCommand = command("redo");
export const undoCommand = command("undo");

// @milkdown/kit/utils
export const callCommand = (): AnyFn => noop;
export const replaceAll = (): AnyFn => noop;
