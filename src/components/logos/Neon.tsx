import React from 'react';
import NeonPng from './neon.png';

export function Neon() {
  return (
    <img
      src={NeonPng}
      alt="Neon Database Logo"
      className="w-full h-full object-contain"
    />
  );
}