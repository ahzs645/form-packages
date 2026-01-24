/**
 * Watermark Component
 * Displays a watermark overlay on the page
 */

import React, { useState, useEffect } from 'react';
import { Stack, Toggle } from '@fluentui/react';

export interface WatermarkProps {
  /** Disable */
  disabled?: boolean;
  /** Text to display */
  label?: string;
  /** Opacity (CSS style parameter) */
  opacity?: number;
  /** @deprecated Use label */
  text?: string;
}

/**
 * Watermark - Displays a watermark overlay on the page
 */
export const Watermark: React.FC<WatermarkProps> = ({
  disabled = false,
  label,
  opacity = 0.05,
  text,
}) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  if (disabled) {
    return null;
  }

  const displayText = label || text;

  if (!displayText) {
    return null;
  }

  const watermarkStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    width: dimensions.width,
    height: dimensions.height,
    fontFamily: 'Times',
    fontSize: '144px',
    pointerEvents: 'none',
    transform: 'rotate(-45deg)',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    opacity: opacity,
    zIndex: 5000,
  };

  return (
    <div style={watermarkStyles}>
      <p>{displayText}</p>
    </div>
  );
};

/**
 * WatermarkDemo1 - Watermark example with toggle
 */
export const WatermarkDemo1: React.FC = () => {
  const [showWatermark, setShowWatermark] = useState(false);

  return (
    <Stack>
      <Toggle
        label="Show watermark"
        checked={showWatermark}
        onText="Watermark on"
        offText="Watermark off"
        onChange={(_, checked) => setShowWatermark(!!checked)}
      />
      <Watermark
        label="Watermark"
        disabled={!showWatermark}
      />
    </Stack>
  );
};

export default Watermark;
