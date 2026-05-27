/**
 * MOIS Markdown sanitisation
 *
 * MOIS renders Markdown through a constrained pipeline. The one mark that is
 * explicitly unsupported across every surface is GitHub-flavoured
 * strikethrough (see the `allowStrikethrough` note in `Markdown.tsx`, which
 * renders `~~x~~` literally). To keep WYSIWYG output MOIS-safe we unwrap any
 * strikethrough back to plain text on serialise.
 *
 * Raw HTML and GFM tables are intentionally left untouched — `RichMarkdownBlock`
 * renders them via `remark-gfm` + `rehype-raw`.
 */
export function sanitizeMoisMarkdown(markdown: string): string {
  if (!markdown) return markdown;
  // Unwrap ~~text~~ -> text. Constrained to a single line and to non-space
  // boundaries so unpaired tildes (e.g. "a ~~ b") are left as written.
  return markdown.replace(/~~(?=\S)([^\n]*?\S)~~/g, "$1");
}
