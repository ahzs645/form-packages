/** Restore named answers to declared source defaults; never touches chart data. */
const ResetAnswersButton = ({ label = "Reset form", answers = {}, disabled = false, readOnly = false }) => {
  const [fd, setFormData] = useActiveData();
  const sd = useSourceData();
  // A persisted record is reset only after the host has reopened it for edit.
  const locked = disabled || readOnly || sd?.webform?.recordState === "SIGNED" || sd?.webform?.isDraft === "N";
  const reset = () => {
    if (locked || typeof setFormData !== "function") return;
    setFormData(produce(draft => {
      draft.field = draft.field || {};
      draft.field.data = draft.field.data || {};
      draft.field.status = draft.field.status || {};
      for (const key of Object.keys(answers)) {
        draft.field.data[key] = JSON.parse(JSON.stringify(answers[key]));
        delete draft.field.status[key];
      }
    }));
  };
  return <Fluent.DefaultButton text={label} disabled={locked} onClick={reset} />;
};
