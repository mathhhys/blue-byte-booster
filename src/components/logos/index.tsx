import React from "react";

// Placeholder SVG components for logos. In a real implementation, replace with actual SVGs.
export const Gemini = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M12 2L2 7v10l10 5 10-5V7z" fill="currentColor" />
  </svg>
);

export const Replit = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
  </svg>
);

export const MagicUI = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

export const VSCodium = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <rect width="24" height="24" fill="currentColor" />
  </svg>
);

export const MediaWiki = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M4 4h16v16H4z" fill="currentColor" />
  </svg>
);

export const GooglePaLM = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

export { Softcodes } from './Softcodes';