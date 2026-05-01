const normalizeItems = (items) => {
  if (!Array.isArray(items)) return []
  return items
    .map((item, index) => {
      const source = item && typeof item === "object" ? item : { label: item }
      const label = typeof source.label === "string" && source.label.trim()
        ? source.label.trim()
        : `Item ${index + 1}`
      const moisModule = typeof source.moisModule === "string" && source.moisModule.trim()
        ? source.moisModule.trim()
        : ""

      return {
        id: source.id || `${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}_${index}`,
        label,
        moisModule,
        objectId: typeof source.objectId === "number" ? source.objectId : undefined,
        title: typeof source.title === "string" && source.title.trim()
          ? source.title.trim()
          : `Open ${moisModule || label} in MOIS`,
      }
    })
    .filter((item) => item.label)
}

function MoisModuleLinkList({
  id = "legacyMoisLinkList",
  introText,
  items = [],
  marginLeft = "2em",
  paddingBottom = 20,
  marginTop = 5,
  itemGap = 4,
}) {
  const normalizedItems = normalizeItems(items)

  return (
    <div id={id} data-field-id={id}>
      {introText ? <p style={{ marginTop: 5, marginBottom: 5 }}>{introText}</p> : null}
      <div style={{ marginLeft }}>
        <ul style={{ paddingBottom, marginTop }}>
          {normalizedItems.map((item) => (
            <li key={item.id} style={{ marginBottom: itemGap }}>
              {item.label}
              {item.moisModule ? (
                <LinkToMois
                  moisModule={item.moisModule}
                  objectId={item.objectId}
                  title={item.title}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
