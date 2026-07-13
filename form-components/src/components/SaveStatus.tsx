/**
 * SaveStatus Component
 * Faithful reproduction of the MOIS save-status indicator.
 *
 * SMOIS parity evidence: SaveStatus `ft` in
 * ~/github/smois/build/static/js/main.a75cc6b1.chunk.js reads loading state,
 * formParams.webformId, and the webform create/modify stamp.
 */

import React from 'react';
import { MessageBar, MessageBarType, Spinner } from '@fluentui/react';
import { useSourceData, useTheme } from '../context/MoisContext';

export interface SaveStatusProps {
  /** Show information even when form has never been saved */
  noHide?: boolean;
  /** Display size */
  size?: 'min' | 'tiny' | 'small' | 'medium' | 'large' | 'max' | string;
}

type SaveStatusSizeStyle = {
  flex?: string;
  minWidth?: string | number;
  maxWidth?: string | number;
  width?: string;
};

export const SaveStatus: React.FC<SaveStatusProps> = ({
  noHide = false,
  size = 'medium',
}) => {
  const sourceData = useSourceData();
  const theme = useTheme();
  const themedSize = (theme.mois.sizes as Record<string, SaveStatusSizeStyle>)[size];
  const styles = {
    root: themedSize ?? { width: size },
  };

  if (sourceData.lifecycleState.isLoading) {
    return <Spinner label="Saving Form" labelPosition="right" styles={styles} />;
  }

  if (sourceData.formParams.webformId) {
    const stamp = sourceData.webform.stamp;
    const savedAt = stamp?.modifyTime || stamp?.createTime;
    const savedDate = savedAt ? new Date(savedAt) : null;
    const formatted = savedDate && !Number.isNaN(savedDate.getTime())
      ? `${savedDate.getFullYear()}.${String(savedDate.getMonth() + 1).padStart(2, '0')}.${String(savedDate.getDate()).padStart(2, '0')} ${String(savedDate.getHours()).padStart(2, '0')}:${String(savedDate.getMinutes()).padStart(2, '0')}`
      : '';

    return (
      <MessageBar styles={styles}>
        Last saved on {formatted}
      </MessageBar>
    );
  }

  return noHide ? (
    <MessageBar messageBarType={MessageBarType.warning} styles={styles}>
      Form has never been saved
    </MessageBar>
  ) : null;
};

export default SaveStatus;
