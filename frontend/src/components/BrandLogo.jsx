import React from 'react';

/**
 * BrandLogo — official SmartSetupUAE wordmark.
 *
 *   • brand-logo.png      → dark green "SMARTSETUP" + gold "UAE"  (cream / light bg)
 *   • brand-logo-dark.png → white       "SMARTSETUP" + gold "UAE"  (green / dark bg)
 *
 * Both PNGs are tightly cropped (1161×261, ~4.45:1) with transparent backgrounds
 * so the height-based sizing always matches the surrounding layout.
 */
export default function BrandLogo({ variant = 'cream', className = 'h-10' }) {
  const src = variant === 'dark' ? '/brand-logo-dark.png' : '/brand-logo.png';
  return (
    <img
      src={src}
      alt="SmartSetupUAE — Setup Smart. Grow Fast."
      draggable={false}
      data-testid="brand-logo"
      className={`w-auto object-contain pointer-events-none select-none notranslate ${className}`}
      translate="no"
    />
  );
}
