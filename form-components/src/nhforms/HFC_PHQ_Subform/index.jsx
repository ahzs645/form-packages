const HFC_PHQ_Subform = (props) => {
  const RuntimeSubformScoring =
    (typeof window !== "undefined" && window.__nhformsRegistry__?.SubformScoring) ||
    SubformScoring

  return <RuntimeSubformScoring {...props} />
}
