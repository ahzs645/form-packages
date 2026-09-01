// Legacy compatibility alias. Saved forms keep their component key and their
// historical dual DCO + panel write behavior; new authoring uses PanelEntryGrid.
const ObservationPanelEditor = (props) => {
  const RuntimePanelEntryGrid =
    (typeof window !== "undefined" && window.__nhformsRegistry__?.PanelEntryGrid) ||
    PanelEntryGrid

  return <RuntimePanelEntryGrid {...props} legacyDcoWrites />
}
