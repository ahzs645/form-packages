const { useMemo } = React

/**
 * RichMarkdownBlock
 *
 * Read-only markdown display for imported builder rich text. Renders inline
 * MOIS chart links written with the reserved `mois:` scheme as LinkToMois
 * buttons:
 *
 *   [](mois:CHARTACTION)            -> just the chart-link icon button
 *   [Open chart](mois:CHARTACTION)  -> "Open chart" text + icon button
 *   [](mois:GOALS/12345)            -> icon button linking to object 12345
 *
 * (Supersedes the former MoisMarkdownBlock, which was a copy of this file with
 * the `mois:` link handling added. One component now covers both.)
 *
 * ---------------------------------------------------------------------------
 * Why this file does not just call ReactMarkdown
 * ---------------------------------------------------------------------------
 * The MOIS form engine evaluates every component with a fixed scope:
 *
 *   Function("React","Fabric","Fluent","MoisControl","MoisFunction",
 *            "MoisActions","MoisHooks","Mois")
 *
 * `ReactMarkdown`, `remarkGfm` and `rehypeRaw` are NOT in it (see
 * data/mois-engine-manifest.json — `Markdown` is a control, ReactMarkdown is
 * not). Only the local preview injects them, so a component that reaches for
 * them bare looks perfect in preview and silently degrades on a real instance.
 * The engine also ships react-markdown 7, which predates `urlTransform`, so
 * the `mois:` scheme would be stripped by the default URI sanitiser before any
 * custom `a` renderer could see it.
 *
 * This component therefore:
 *   - rewrites `](mois:X)` to `](#mois:X)` in the source, a fragment URL every
 *     react-markdown version passes through untouched, so no version-specific
 *     `urlTransform` / `transformLinkUri` prop is needed;
 *   - renders through the engine's own `Markdown` control when ReactMarkdown
 *     is absent (i.e. on a real MOIS instance);
 *   - parses GFM tables itself when `remarkGfm` is absent, so tables render on
 *     MOIS instead of falling through as literal pipe characters.
 *
 * Known limitation: raw HTML in the markdown needs `rehypeRaw`, which the
 * engine does not provide. It is dropped on MOIS, exactly as the engine's own
 * `Markdown` control drops it.
 */

const HAS_REACT_MARKDOWN = typeof ReactMarkdown !== "undefined"
const HAS_REMARK_GFM = typeof remarkGfm !== "undefined"
const HAS_REHYPE_RAW = typeof rehypeRaw !== "undefined"

const defaultRemarkPlugins = HAS_REMARK_GFM ? [remarkGfm] : []
const defaultRehypePlugins = HAS_REHYPE_RAW ? [rehypeRaw] : []

const fullWidthStyle = {
  maxWidth: "none",
  width: "100%",
}

const linkStyle = {
  color: "#005a9e",
  textDecoration: "underline",
}

const moisLinkWrapperStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  verticalAlign: "middle",
}

// ---------------------------------------------------------------------------
// MOIS chart links
// ---------------------------------------------------------------------------

/**
 * react-markdown 7 (MOIS) and 9+ (preview) both sanitise unknown URL schemes,
 * and they disagree on the prop name for overriding that. Both, however, leave
 * a URL whose first character is `#` alone, so the reserved scheme travels as
 * a fragment and is unpacked in the `a` renderer below.
 */
const normalizeMoisLinks = (text) =>
  typeof text === "string" ? text.replace(/\]\(\s*mois:/gi, "](#mois:") : ""

// Parse a MOIS link href into a module name + optional object id.
//   #mois:CHARTACTION   -> { moisModule: "CHARTACTION" }
//   mois://CHARTACTION  -> { moisModule: "CHARTACTION" }
//   #mois:GOALS/12345   -> { moisModule: "GOALS", objectId: 12345 }
const parseMoisHref = (href) => {
  if (typeof href !== "string") return null
  const match = href.match(/^#?mois:(?:\/\/)?([^/?#]+)(?:\/(\d+))?$/i)
  if (!match) return null
  const moisModule = decodeURIComponent(match[1]).trim()
  if (!moisModule) return null
  const parsedId = match[2] ? Number(match[2]) : undefined
  return { moisModule, objectId: Number.isFinite(parsedId) ? parsedId : undefined }
}

const hasVisibleChildren = (children) =>
  React.Children.toArray(children).some(
    (child) => !(typeof child === "string" && child.trim() === "")
  )

const renderMoisLink = (mois, children, key) => (
  <span key={key} style={moisLinkWrapperStyle}>
    {hasVisibleChildren(children) ? <span>{children}</span> : null}
    <LinkToMois
      moisModule={mois.moisModule}
      objectId={mois.objectId}
      title={`Open ${mois.moisModule} in MOIS`}
    />
  </span>
)

// ---------------------------------------------------------------------------
// GFM table fallback (engine has no remark-gfm)
// ---------------------------------------------------------------------------

const tableWrapperStyle = { overflowX: "auto", width: "100%", maxWidth: "none" }

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  border: "1px solid black",
}

const theadStyle = { backgroundColor: "#f3f2f1" }
const trStyle = { verticalAlign: "top" }

const thStyle = {
  border: "1px solid black",
  padding: "6px 8px",
  textAlign: "left",
  verticalAlign: "top",
  fontWeight: 700,
}

const tdStyle = {
  border: "1px solid black",
  padding: "6px 8px",
  verticalAlign: "top",
  whiteSpace: "pre-wrap",
}

/** Split one table row into cells, honouring `\|` escapes. */
const splitTableRow = (line) => {
  const trimmed = String(line).trim().replace(/^\|/, "").replace(/\|$/, "")
  const cells = []
  let current = ""
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i]
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "|"
      i += 1
      continue
    }
    if (char === "|") {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

const isTableDelimiterRow = (line) => {
  if (typeof line !== "string" || line.indexOf("-") === -1) return false
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell))
}

const cellAlignment = (cell) => {
  const startsWithColon = cell.charAt(0) === ":"
  const endsWithColon = cell.charAt(cell.length - 1) === ":"
  if (startsWithColon && endsWithColon) return "center"
  if (endsWithColon) return "right"
  if (startsWithColon) return "left"
  return undefined
}

/**
 * Split markdown into plain segments and GFM table blocks. Only used when
 * remark-gfm is unavailable; with the plugin present the tables are left in
 * the source so react-markdown parses them exactly as it always has.
 */
const splitMarkdownSegments = (text) => {
  const lines = String(text).split("\n")
  const segments = []
  let buffer = []

  const flush = () => {
    if (buffer.length === 0) return
    segments.push({ kind: "markdown", text: buffer.join("\n") })
    buffer = []
  }

  let inFence = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const next = lines[index + 1]
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    // A pipe table inside a fenced code block is sample text, not a table.
    if (!inFence && line.indexOf("|") !== -1 && isTableDelimiterRow(next)) {
      const header = splitTableRow(line)
      const align = splitTableRow(next).map(cellAlignment)
      const rows = []
      let cursor = index + 2
      for (; cursor < lines.length; cursor += 1) {
        const rowLine = lines[cursor]
        if (!rowLine.trim() || rowLine.indexOf("|") === -1) break
        rows.push(splitTableRow(rowLine))
      }
      flush()
      segments.push({ kind: "table", header, align, rows })
      index = cursor - 1
      continue
    }
    buffer.push(line)
  }

  flush()
  return segments
}

/**
 * Minimal inline renderer for table cells. The engine cannot parse the cell
 * content for us (no remark-gfm means the table never becomes an AST), and
 * nesting one `Markdown` control per cell would be far heavier than the four
 * marks that actually appear in imported rich text.
 */
const INLINE_PATTERN = /`([^`]+)`|\[([^\]]*)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*/g

const renderInlineMarkdown = (text, keyPrefix) => {
  const source = typeof text === "string" ? text : ""
  const nodes = []
  let lastIndex = 0
  let match

  INLINE_PATTERN.lastIndex = 0
  while ((match = INLINE_PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) nodes.push(source.slice(lastIndex, match.index))
    const key = `${keyPrefix}-${match.index}`
    if (match[1] != null) {
      nodes.push(<code key={key}>{match[1]}</code>)
    } else if (match[3] != null) {
      const mois = parseMoisHref(match[3])
      nodes.push(
        mois ? (
          renderMoisLink(mois, match[2], key)
        ) : (
          <a key={key} style={linkStyle} href={match[3]} target="_blank" rel="noreferrer">
            {match[2]}
          </a>
        )
      )
    } else if (match[4] != null || match[5] != null) {
      nodes.push(<strong key={key}>{match[4] != null ? match[4] : match[5]}</strong>)
    } else {
      nodes.push(<em key={key}>{match[6]}</em>)
    }
    lastIndex = INLINE_PATTERN.lastIndex
  }

  if (lastIndex < source.length) nodes.push(source.slice(lastIndex))
  return nodes
}

const renderTableSegment = (segment, key) => (
  <div key={key} style={tableWrapperStyle}>
    <table style={tableStyle}>
      <thead style={theadStyle}>
        <tr style={trStyle}>
          {segment.header.map((cell, cellIndex) => (
            <th key={cellIndex} style={{ ...thStyle, textAlign: segment.align[cellIndex] || "left" }}>
              {renderInlineMarkdown(cell, `h${cellIndex}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {segment.rows.map((row, rowIndex) => (
          <tr key={rowIndex} style={trStyle}>
            {segment.header.map((_, cellIndex) => (
              <td
                key={cellIndex}
                style={{ ...tdStyle, textAlign: segment.align[cellIndex] || undefined }}
              >
                {renderInlineMarkdown(row[cellIndex], `r${rowIndex}c${cellIndex}`)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ---------------------------------------------------------------------------
// Renderer overrides shared by both rendering paths
// ---------------------------------------------------------------------------

// `node` is react-markdown's AST handle. Spreading it onto a DOM element makes
// React warn about an unknown prop, so every renderer drops it explicitly.
const baseComponents = {
  p: ({ children, node, ...props }) => <p style={fullWidthStyle} {...props}>{children}</p>,
  div: ({ children, node, ...props }) => <div style={fullWidthStyle} {...props}>{children}</div>,
  ul: ({ children, node, ...props }) => (
    <ul
      style={{
        ...fullWidthStyle,
        paddingLeft: 20,
        marginTop: 2,
        marginBottom: 2,
      }}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, node, ...props }) => (
    <ol
      style={{
        ...fullWidthStyle,
        paddingLeft: 20,
        marginTop: 2,
        marginBottom: 2,
      }}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, node, ...props }) => <li style={{ marginTop: 0, marginBottom: 2 }} {...props}>{children}</li>,
  // MOIS does not support strikethrough; its own Markdown control renders the
  // tildes literally, and so do we, in both environments.
  del: ({ children }) => <span>~~{children}~~</span>,
  blockquote: ({ children, node, ...props }) => <blockquote style={fullWidthStyle} {...props}>{children}</blockquote>,
  pre: ({ children, node, ...props }) => <pre style={{ ...fullWidthStyle, overflow: "auto" }} {...props}>{children}</pre>,
  a: ({ children, href, node, ...props }) => {
    const mois = parseMoisHref(href)
    if (mois) return renderMoisLink(mois, children)
    return (
      <a style={linkStyle} target="_blank" rel="noreferrer" href={href} {...props}>
        {children}
      </a>
    )
  },
  table: ({ children, node, ...props }) => (
    <div style={tableWrapperStyle}>
      <table style={tableStyle} {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, node, ...props }) => <thead style={theadStyle} {...props}>{children}</thead>,
  tbody: ({ children, node, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, node, ...props }) => <tr style={trStyle} {...props}>{children}</tr>,
  th: ({ children, node, ...props }) => <th style={thStyle} {...props}>{children}</th>,
  td: ({ children, node, ...props }) => <td style={tdStyle} {...props}>{children}</td>,
}

/**
 * One markdown segment. Preview has ReactMarkdown in scope and keeps using it;
 * the engine does not, and falls back to its own `Markdown` control, which is
 * the only markdown renderer guaranteed to exist on a real instance.
 */
// Held behind a local binding rather than used as a bare `<ReactMarkdown>` tag:
// the identifier is not in the engine's form scope, and the export-time scope
// check should keep flagging it for components that reach for it unguarded.
const PreviewMarkdownRenderer = HAS_REACT_MARKDOWN ? ReactMarkdown : null

const MarkdownSegment = ({ text, markdownProps }) => {
  if (PreviewMarkdownRenderer) {
    return <PreviewMarkdownRenderer {...markdownProps}>{text}</PreviewMarkdownRenderer>
  }
  return (
    <Markdown
      source={text}
      readOnly
      borderless
      label=""
      labelPosition="none"
      size="100%"
      markdownProps={markdownProps}
    />
  )
}

const RichMarkdownBlock = ({
  id,
  fieldId,
  label,
  labelPosition = "top",
  size,
  source,
  value,
  height,
  hidden,
  disabled,
  required,
  note,
  moisModule,
  section,
  placement,
  layoutId,
  index,
  isComplete,
  borderless = false,
  style,
  markdownProps,
}) => {
  const rawContent = typeof source === "string" ? source : (typeof value === "string" ? value : "")
  const content = normalizeMoisLinks(rawContent)
  const effectiveFieldId = fieldId || id

  const mergedMarkdownProps = useMemo(() => {
    const extra = markdownProps && typeof markdownProps === "object" ? markdownProps : {}
    const extraPlugins = Array.isArray(extra.remarkPlugins) ? extra.remarkPlugins : []
    return {
      ...extra,
      remarkPlugins: [...defaultRemarkPlugins, ...extraPlugins],
      rehypePlugins: [...defaultRehypePlugins, ...(Array.isArray(extra.rehypePlugins) ? extra.rehypePlugins : [])],
      components: {
        ...baseComponents,
        ...(extra.components && typeof extra.components === "object" ? extra.components : {}),
      },
    }
  }, [markdownProps])

  const segments = useMemo(
    () => (HAS_REMARK_GFM ? [{ kind: "markdown", text: content }] : splitMarkdownSegments(content)),
    [content]
  )

  // The engine's `Markdown` control pulls its content up by 8px; cancel that
  // out so the block sits where it does with ReactMarkdown.
  const marginTop = (borderless ? -8 : 0) + (HAS_REACT_MARKDOWN ? 0 : 8)

  return (
    <LayoutItem
      disabled={disabled}
      fieldId={effectiveFieldId}
      hidden={hidden}
      id={id}
      index={index}
      isComplete={isComplete}
      isEmpty={!content}
      label={label}
      labelPosition={labelPosition}
      layoutId={layoutId}
      moisModule={moisModule}
      note={note}
      placement={placement}
      readOnly
      required={required}
      section={section}
      size={size}
      layoutStyle={style}
    >
      <div
        className="markdown-content"
        style={{
          width: "100%",
          margin: `${marginTop}px 0 0`,
          fontFamily: 'Times, "Times New Roman", serif',
          maxWidth: "none",
          ...(typeof height === "number" && Number.isFinite(height) && height > 0
            ? { height: `${Math.round(height)}px`, overflow: "auto" }
            : {}),
        }}
      >
        {segments.map((segment, segmentIndex) =>
          segment.kind === "table" ? (
            renderTableSegment(segment, segmentIndex)
          ) : segment.text.trim() ? (
            <MarkdownSegment
              key={segmentIndex}
              text={segment.text}
              markdownProps={mergedMarkdownProps}
            />
          ) : null
        )}
      </div>
    </LayoutItem>
  )
}
