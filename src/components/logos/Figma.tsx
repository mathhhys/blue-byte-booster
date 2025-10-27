import React from 'react';
import FigmaPng from './figma.png';

export function Figma() {
  return (
    <img
      src={FigmaPng}
      alt="Figma Logo"
      className="w-full h-full object-contain"
    />
  );
}