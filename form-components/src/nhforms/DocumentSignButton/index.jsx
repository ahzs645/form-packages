const DocumentSignButton = ({ disabled = false, preparePersist, getSaveData }) => {
  const sd = useSourceData();
  const [fd, setFormData] = useActiveData();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const running = React.useRef(false);
  const signed = sd?.webform?.recordState === "SIGNED";
  const available = signed || (sd?.webform?.isDraft === "N" && fd?.uiState?.sections?.[0]?.isComplete !== false);
  const dismiss = () => { if (!running.current) { setOpen(false); setReason(""); setError(""); } };
  const confirm = async () => {
    if (running.current || disabled || !available) return;
    const note = reason.trim();
    if (signed && !note) { setError("Enter a reason for unsigning this form."); return; }
    running.current = true;
    setBusy(true);
    setError("");
    try {
      let prepared = null;
      let success;
      if (signed) {
        // MOIS module 53: third argument is an optional callback, not active data.
        success = await unsign(note, sd);
      } else {
        if (typeof preparePersist !== "function" || typeof getSaveData !== "function") {
          throw new Error("This form does not provide signature persistence.");
        }
        prepared = preparePersist(fd, "sign");
        // MOIS sign alone cannot persist claims. Its combined transport writes
        // the prepared snapshot and signature record in the same request.
        success = await signSubmit(note, sd, fd, getSaveData(prepared));
      }
      if (success !== true) throw new Error("The signature action was not confirmed. Please try again.");
      setFormData(produce((draft) => {
        draft.uiState = draft.uiState || {};
        draft.uiState.sections = draft.uiState.sections || {};
        for (const key of new Set(["0", ...Object.keys(draft.uiState.sections)])) {
          draft.uiState.sections[key] = { ...(draft.uiState.sections[key] || {}), isComplete: !signed };
        }
        if (prepared?.formData) {
          draft.field = draft.field || {};
          draft.field.data = prepared.formData;
          draft.formData = { ...(draft.formData || {}), ...prepared.formData };
        }
      }));
      setOpen(false);
      setReason("");
    } catch (failure) {
      setError(failure?.message || "Unable to change the signature state.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return <>
    <Fluent.DefaultButton text={signed ? "Unsign" : "Sign"}
      disabled={disabled || busy || !available || !sd?.formParams?.documentId}
      onClick={() => { setReason(""); setError(""); setOpen(true); }} />
    <Fluent.Dialog hidden={!open} onDismiss={dismiss}
      dialogContentProps={{ title: signed ? "Unsign current record" : "Sign current record" }}
      modalProps={{ isBlocking: true }}>
      <Fluent.Stack tokens={{ childrenGap: 12 }}>
        <Fluent.Text>{sd?.userProfile?.identity?.fullName || "Current user"}</Fluent.Text>
        <Fluent.Text>{signed
          ? "Unsigning reopens the form. Existing author ownership and editing windows still apply."
          : "Signing makes this form read-only for all users."}</Fluent.Text>
        <Fluent.TextField label={signed ? "Reason for unsigning" : "Reason (optional)"}
          required={signed} multiline rows={3} value={reason} disabled={busy}
          onChange={(_, value) => setReason(value || "")} />
        {error ? <div role="alert">{error}</div> : null}
      </Fluent.Stack>
      <Fluent.DialogFooter>
        <Fluent.PrimaryButton text={signed ? "Unsign" : "Sign"} onClick={confirm}
          disabled={busy || (signed && !reason.trim())} />
        <Fluent.DefaultButton text="Cancel" onClick={dismiss} disabled={busy} />
      </Fluent.DialogFooter>
    </Fluent.Dialog>
  </>;
};
