const { useMemo } = React

/**
 * MoisMarkdownBlock
 *
 * A MOIS-aware sibling of RichMarkdownBlock. It renders identically to
 * RichMarkdownBlock EXCEPT that links using the reserved `mois:` scheme become
 * an inline LinkToMois chart button instead of a plain anchor:
 *
 *   [](mois:CHARTACTION)            -> just the chart-link icon button
 *   [Open chart](mois:CHARTACTION)  -> "Open chart" text + icon button
 *   [](mois:GOALS/12345)            -> icon button linking to object 12345
 *
 * When the Markdown contains no `mois:` links the output is byte-for-byte the
 * same as RichMarkdownBlock, so it can stand in anywhere that block is used.
 * Authored standalone (no runtime dependency on RichMarkdownBlock, which is
 * intentionally left untouched).
 */

const fullWidthStyle = {
  maxWidth: "none",
  width: "100%",
}

// Parse a `mois:` link href into a module name + optional object id.
//   mois:CHARTACTION      -> { moisModule: "CHARTACTION" }
//   mois://CHARTACTION     -> { moisModule: "CHARTACTION" }
//   mois:GOALS/12345       -> { moisModule: "GOALS", objectId: 12345 }
const parseMoisHref = (href) => {
  if (typeof href !== "string") return null
  const match = href.match(/^mois:(?:\/\/)?([^/?#]+)(?:\/(\d+))?$/i)
  if (!match) return null
  const moisModule = decodeURIComponent(match[1]).trim()
  if (!moisModule) return null
  const parsedId = match[2] ? Number(match[2]) : undefined
  return { moisModule, objectId: Number.isFinite(parsedId) ? parsedId : undefined }
}

const urlTransform = (value) => {
  if (typeof value === "string" && /^mois:/i.test(value)) return value
  if (typeof value !== "string") return ""
  const colon = value.indexOf(":")
  const questionMark = value.indexOf("?")
  const numberSign = value.indexOf("#")
  const slash = value.indexOf("/")
  const hasAllowedProtocol = /^(https?|ircs?|mailto|xmpp)$/i.test(value.slice(0, colon))
  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    hasAllowedProtocol
  ) {
    return value
  }
  return ""
}

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
  blockquote: ({ children, node, ...props }) => <blockquote style={fullWidthStyle} {...props}>{children}</blockquote>,
  pre: ({ children, node, ...props }) => <pre style={{ ...fullWidthStyle, overflow: "auto" }} {...props}>{children}</pre>,
  a: ({ children, href, node, ...props }) => {
    const mois = parseMoisHref(href)
    if (mois) {
      const hasLabel = React.Children.toArray(children).some(
        (child) => !(typeof child === "string" && child.trim() === "")
      )
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle" }}>
          {hasLabel ? <span>{children}</span> : null}
          <LinkToMois
            moisModule={mois.moisModule}
            objectId={mois.objectId}
            title={`Open ${mois.moisModule} in MOIS`}
          />
        </span>
      )
    }
    return (
      <a
        style={{
          color: "#005a9e",
          textDecoration: "underline",
        }}
        target="_blank"
        rel="noreferrer"
        href={href}
        {...props}
      >
        {children}
      </a>
    )
  },
  table: ({ children, node, ...props }) => (
    <div style={{ overflowX: "auto", width: "100%", maxWidth: "none" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          border: "1px solid black",
        }}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, node, ...props }) => <thead style={{ backgroundColor: "#f3f2f1" }} {...props}>{children}</thead>,
  tbody: ({ children, node, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, node, ...props }) => <tr style={{ verticalAlign: "top" }} {...props}>{children}</tr>,
  th: ({ children, node, ...props }) => (
    <th
      style={{
        border: "1px solid black",
        padding: "6px 8px",
        textAlign: "left",
        verticalAlign: "top",
        fontWeight: 700,
      }}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, node, ...props }) => (
    <td
      style={{
        border: "1px solid black",
        padding: "6px 8px",
        verticalAlign: "top",
        whiteSpace: "pre-wrap",
      }}
      {...props}
    >
      {children}
    </td>
  ),
}

const MoisMarkdownBlock = ({
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
  const content = typeof source === "string" ? source : (typeof value === "string" ? value : "")
  const effectiveFieldId = fieldId || id
  const mergedMarkdownProps = useMemo(() => {
    const extra = markdownProps && typeof markdownProps === "object" ? markdownProps : {}
    const extraPlugins = Array.isArray(extra.remarkPlugins) ? extra.remarkPlugins : []
    return {
      ...extra,
      urlTransform: extra.urlTransform || urlTransform,
      remarkPlugins: [remarkGfm, ...extraPlugins],
      rehypePlugins: [rehypeRaw, ...(Array.isArray(extra.rehypePlugins) ? extra.rehypePlugins : [])],
      components: {
        ...baseComponents,
        ...(extra.components && typeof extra.components === "object" ? extra.components : {}),
      },
    }
  }, [markdownProps])

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
          margin: borderless ? "-8px 0 0" : 0,
          fontFamily: 'Times, "Times New Roman", serif',
          maxWidth: "none",
          ...(typeof height === "number" && Number.isFinite(height) && height > 0
            ? { height: `${Math.round(height)}px`, overflow: "auto" }
            : {}),
        }}
      >
        <ReactMarkdown {...mergedMarkdownProps}>
          {content}
        </ReactMarkdown>
      </div>
    </LayoutItem>
  )
}
