/**
 * PrintButton Component
 * Print button. When pushed, the print action is started.
 */

import React from 'react';
import { DefaultButton } from '@fluentui/react';
import { useButtonSize, ButtonSize, useSourceData } from '../context/MoisContext';
import {
  applyShimmedMoisLifecyclePreviewState,
  emitMoisPreviewDiagnosticEvent,
} from '../runtime/mois-contract';

/** Print options for customizing print behavior */
export interface PrintOptions {
  /** Print orientation */
  orientation?: 'portrait' | 'landscape';
  /** Paper size */
  paperSize?: string;
  /** Include headers/footers */
  includeHeaderFooter?: boolean;
}

export interface PrintButtonProps {
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** Button label. Default is "Print" */
  label?: string;
  /** A callback when button is clicked. Default is print */
  onClick?: () => void;
  /** Printing options */
  printOptions?: PrintOptions;
  /** Button size (min, tiny, small, medium, large, max) */
  size?: ButtonSize;
  /**
   * @deprecated Use label instead
   */
  text?: string;
}

/**
 * PrintButton - Print form button
 *
 * When clicked, initiates the browser print dialog or
 * custom print handling if onClick is provided.
 */
export const PrintButton: React.FC<PrintButtonProps> = ({
  disabled,
  label,
  onClick,
  printOptions = {},
  size = 'small',
  text,
}) => {
  const sourceData = useSourceData();
  // Use label, fall back to deprecated text prop, then default
  const buttonText = label || text || 'Print';

  // Get theme-based button styles (centralized)
  const buttonStyles = useButtonSize(size);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      applyShimmedMoisLifecyclePreviewState(sourceData, 'print-started', printOptions);
      emitMoisPreviewDiagnosticEvent({
        severity: 'warning',
        source: 'shimmed-print-preview',
        message: 'Preview PrintButton uses browser window.print(); Shimmed MOIS print/render completion is IPC-driven.',
        path: 'PrintButton',
        detail: {
          expectedRenderCompleteShape: { type: 'printed', data: [] },
          printOptions,
        },
      });
      window.print();
      applyShimmedMoisLifecyclePreviewState(sourceData, 'printed', { type: 'printed', data: [] });
    }
  };

  return (
    <DefaultButton
      data-automation-id="print"
      text={buttonText}
      disabled={disabled}
      onClick={handleClick}
      styles={buttonStyles}
    />
  );
};

export default PrintButton;
