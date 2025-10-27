import React from 'react';

export function MagicUI(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}