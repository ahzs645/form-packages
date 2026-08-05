/**
 * MOIS Markdown sanitisation
 *
 * MOIS renders Markdown through a constrained pipeline. The one mark that is
 * explicitly unsupported across every surface is GitHub-flavoured
 * strikethrough (see the `allowStrikethrough` note in `Markdown.tsx`, which
 * renders `~~x~~` literally). To keep WYSIWYG output MOIS-safe we unwrap any
 * strikethrough back to plain text on serialise.
 *
 * GFM tables are intentionally left untouched — `RichMarkdownBlock` parses them
 * itself on MOIS (the engine ships no `remark-gfm`) and through the plugin in
 * preview. Raw HTML survives serialisation but only renders in preview: the
 * engine has no `rehype-raw`, so a real instance drops it.
 */
export function sanitizeMoisMarkdown(markdown: string): string {
  if (!markdown) return markdown;
  // Unwrap ~~text~~ -> text. Constrained to a single line and to non-space
  // boundaries so unpaired tildes (e.g. "a ~~ b") are left as written.
  return markdown.replace(/~~(?=\S)([^\n]*?\S)~~/g, "$1");
}
