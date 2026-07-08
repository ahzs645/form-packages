const INVESTIGATION_DEFAULT_TABS = [
  "Physiology",
  "Medication",
  "History / Physical",
  "Investigation",
  "Review",
  "Information",
]

const normalizeInvestigationTabs = (tabs) => {
  const source = Array.isArray(tabs) && tabs.length > 0 ? tabs : INVESTIGATION_DEFAULT_TABS
  return source.map((tab, index) => {
    if (typeof tab === "string") {
      return { id: index, label: tab || `Tab ${index + 1}` }
    }
    const label =
      typeof tab?.label === "string" && tab.label.trim()
        ? tab.label.trim()
        : `Tab ${index + 1}`
    const id = tab?.id ?? index
    return { id, label }
  })
}

const InvestigationTab = ({ children }) => <>{children}</>

const InvestigationTabs = ({
  tabs,
  defaultTab = 0,
  showNumbers = true,
  children,
}) => {
  const resolvedTabs = React.useMemo(() => normalizeInvestigationTabs(tabs), [tabs])
  const [activeIndex, setActiveIndex] = React.useState(() => {
    const numeric = Number(defaultTab)
    if (!Number.isFinite(numeric)) return 0
    return Math.min(Math.max(Math.trunc(numeric), 0), Math.max(resolvedTabs.length - 1, 0))
  })

  React.useEffect(() => {
    setActiveIndex((current) => Math.min(Math.max(current, 0), Math.max(resolvedTabs.length - 1, 0)))
  }, [resolvedTabs.length])

  const childArray = React.Children.toArray(children)
  const childById = new Map()
  childArray.forEach((child, index) => {
    if (!React.isValidElement(child)) return
    const props = child.props || {}
    const childTabId = props.tabId ?? props.id ?? index
    childById.set(childTabId, props.children)
  })

  const activeTab = resolvedTabs[activeIndex] || resolvedTabs[0] || { id: 0, label: "Tab 1" }
  const activeChildren =
    childById.has(activeTab.id)
      ? childById.get(activeTab.id)
      : childArray[activeIndex] || childArray[0] || null

  return (
    <div
      data-nhforms-investigation-tabs
      style={{
        border: "1px solid #b8b8b8",
        background: "#f3f3f3",
        color: "#202020",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 12,
      }}
    >
      <div
        role="tablist"
        aria-label="Investigation sections"
        className="hideonprint"
        style={{
          display: "flex",
          alignItems: "stretch",
          borderBottom: "1px solid #b8b8b8",
          background: "#eeeeee",
          overflowX: "auto",
        }}
      >
        {resolvedTabs.map((tab, index) => {
          const selected = index === activeIndex
          return (
            <button
              key={String(tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`investigation-tab-panel-${index}`}
              onClick={() => setActiveIndex(index)}
              style={{
                minWidth: 118,
                padding: "6px 12px 5px",
                border: 0,
                borderRight: "1px solid #d2d2d2",
                borderBottom: selected ? "1px solid #ffffff" : "1px solid #b8b8b8",
                background: selected ? "#ffffff" : "#f4f4f4",
                color: "#202020",
                cursor: "pointer",
                font: "inherit",
                fontWeight: selected ? 700 : 400,
                lineHeight: 1.2,
                marginBottom: selected ? -1 : 0,
                outline: selected ? "1px dotted #6f6f6f" : "none",
                outlineOffset: -4,
              }}
            >
              <span style={{ display: "block", whiteSpace: "nowrap" }}>{tab.label}</span>
              {showNumbers ? (
                <span style={{ display: "block", marginTop: 1, color: "#333333" }}>{index + 1}</span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div
        className="showonprint"
        style={{
          display: "none",
          borderBottom: "1px solid #b8b8b8",
          background: "#dedbd8",
          padding: "4px 6px",
          fontWeight: 700,
        }}
      >
        {activeTab.label}
      </div>
      <div
        id={`investigation-tab-panel-${activeIndex}`}
        role="tabpanel"
        aria-label={activeTab.label}
        style={{
          minHeight: 420,
          background: "#ffffff",
        }}
      >
        {activeChildren}
      </div>
    </div>
  )
}
