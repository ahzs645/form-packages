/**
 * SaveOnClose Component
 * Automatically saves form data as draft when the browser window/tab is closed.
 * Only saves if the form is still in draft state (not signed/submitted).
 */

const { useEffect } = React

/**
 * SaveOnClose - Renders nothing but sets up auto-save on window close
 *
 * @param {Object} props
 * @param {Function} props.getSaveData - Function that returns the save data object
 * @param {boolean} props.disabled - If true, disables the save on close behavior
 */
const SaveOnClose = ({ getSaveData, disabled = false }) => {
  const sd = useSourceData()
  const [fd] = useActiveData()

  useEffect(() => {
    if (disabled) return

    window.onbeforeunload = () => {
      // Only save if form is still a draft (not signed/submitted)
      const isDraft = sd?.webform?.isDraft
      if (isDraft === 'N') {
        // Form is already signed, don't auto-save
        return
      }

      // Get save data from prop function or use default
      const saveData = getSaveData
        ? getSaveData()
        : { formData: fd?.field?.data, webformUpdate: null }

      // Trigger draft save
      saveDraft(sd, fd, saveData)
    }

    return () => {
      window.onbeforeunload = null
    }
  }, [sd, fd, getSaveData, disabled])

  // This component renders nothing - it only sets up the side effect
  return null
}

/**
 * useSaveOnClose - Hook version for more control
 *
 * @param {Function} getSaveData - Function that returns the save data object
 * @param {boolean} disabled - If true, disables the save on close behavior
 */
const useSaveOnClose = (getSaveData, disabled = false) => {
  const sd = useSourceData()
  const [fd] = useActiveData()

  useEffect(() => {
    if (disabled) return

    window.onbeforeunload = () => {
      const isDraft = sd?.webform?.isDraft
      if (isDraft === 'N') return

      const saveData = getSaveData
        ? getSaveData()
        : { formData: fd?.field?.data, webformUpdate: null }

      saveDraft(sd, fd, saveData)
    }

    return () => {
      window.onbeforeunload = null
    }
  }, [sd, fd, getSaveData, disabled])
}

// Note: No export statements - nhforms loading extracts components by name
