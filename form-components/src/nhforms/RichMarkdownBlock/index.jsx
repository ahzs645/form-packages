const { useMemo } = React

const fullWidthStyle = {
  maxWidth: "none",
  width: "100%",
}

const baseComponents = {
  p: ({ children, ...props }) => <p style={fullWidthStyle} {...props}>{children}</p>,
  div: ({ children, ...props }) => <div style={fullWidthStyle} {...props}>{children}</div>,
  ul: ({ children, ...props }) => (
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
  ol: ({ children, ...props }) => (
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
  li: ({ children, ...props }) => <li style={{ marginTop: 0, marginBottom: 2 }} {...props}>{children}</li>,
  blockquote: ({ children, ...props }) => <blockquote style={fullWidthStyle} {...props}>{children}</blockquote>,
  pre: ({ children, ...props }) => <pre style={{ ...fullWidthStyle, overflow: "auto" }} {...props}>{children}</pre>,
  a: ({ children, ...props }) => (
    <a
      style={{
        color: "#005a9e",
        textDecoration: "underline",
      }}
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  table: ({ children, ...props }) => (
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
  thead: ({ children, ...props }) => <thead style={{ backgroundColor: "#f3f2f1" }} {...props}>{children}</thead>,
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => <tr style={{ verticalAlign: "top" }} {...props}>{children}</tr>,
  th: ({ children, ...props }) => (
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
  td: ({ children, ...props }) => (
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
  const content = typeof source === "string" ? source : (typeof value === "string" ? value : "")
  const effectiveFieldId = fieldId || id
  const mergedMarkdownProps = useMemo(() => {
    const extra = markdownProps && typeof markdownProps === "object" ? markdownProps : {}
    const extraPlugins = Array.isArray(extra.remarkPlugins) ? extra.remarkPlugins : []
    return {
      ...extra,
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
