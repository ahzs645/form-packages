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
  const tabRefs = React.useRef([])
  const [activeIndex, setActiveIndex] = React.useState(() => {
    const numeric = Number(defaultTab)
    if (!Number.isFinite(numeric)) return 0
    return Math.min(Math.max(Math.trunc(numeric), 0), Math.max(resolvedTabs.length - 1, 0))
  })

  const handleTabListKeyDown = (event) => {
    const count = resolvedTabs.length
    if (count === 0) return
    let next = null
    if (event.key === "ArrowRight") next = (activeIndex + 1) % count
    else if (event.key === "ArrowLeft") next = (activeIndex - 1 + count) % count
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = count - 1
    if (next === null) return
    event.preventDefault()
    setActiveIndex(next)
    const target = tabRefs.current[next]
    if (target && typeof target.focus === "function") target.focus()
  }

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
        onKeyDown={handleTabListKeyDown}
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
              tabIndex={selected ? 0 : -1}
              ref={(node) => { tabRefs.current[index] = node }}
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
      {resolvedTabs.map((tab, index) => {
        const isActive = index === activeIndex
        const panelChildren = childById.has(tab.id)
          ? childById.get(tab.id)
          : childArray[index] ?? (isActive ? childArray[0] ?? null : null)
        return (
          <React.Fragment key={String(tab.id)}>
            {/* Print includes every tab in order, each under its own label
                bar; on screen only the active panel is visible. */}
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
              {tab.label}
            </div>
            <div
              id={`investigation-tab-panel-${index}`}
              role="tabpanel"
              aria-label={tab.label}
              aria-hidden={isActive ? undefined : "true"}
              className={isActive ? undefined : "showonprint"}
              style={{
                minHeight: isActive ? 420 : 0,
                background: "#ffffff",
                ...(isActive ? {} : { display: "none" }),
              }}
            >
              {panelChildren}
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
