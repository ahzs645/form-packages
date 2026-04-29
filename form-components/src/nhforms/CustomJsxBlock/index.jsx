const { useMemo } = React

function CustomJsxBlock({
  id,
  fieldId,
  label,
  jsxSource,
  source,
  code,
  mode = "jsx",
  htmlSource,
  style,
}) {
  const displaySource = useMemo(() => {
    const raw = jsxSource || source || code || htmlSource || ""
    return typeof raw === "string" ? raw.trim() : ""
  }, [jsxSource, source, code, htmlSource])

  if (mode === "html" || htmlSource) {
    return (
      <div
        id={id || fieldId}
        data-field-id={fieldId || id}
        data-custom-jsx-block
        style={style}
        dangerouslySetInnerHTML={{ __html: htmlSource || displaySource }}
      />
    )
  }

  return (
    <div
      id={id || fieldId}
      data-field-id={fieldId || id}
      data-custom-jsx-block
      style={{
        border: "1px dashed #c8c6c4",
        background: "#faf9f8",
        color: "#323130",
        padding: 8,
        fontSize: 12,
        whiteSpace: "pre-wrap",
        ...style,
      }}
    >
      {label ? <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div> : null}
      {displaySource || "Custom JSX source will render in the MOIS export."}
    </div>
  )
}

